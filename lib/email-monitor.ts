import { Resend } from "resend";
import { requirePool } from "./store";
import type { EmailInput } from "./notifications";

export async function trackEmail(input: EmailInput, status: string, providerId?: string, error?: string) {
  if (!process.env.DATABASE_URL) return;
  await requirePool().query(`INSERT INTO email_delivery_log(event_key,recipient,category,event_type,subject,status,provider_id,last_error)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(event_key) DO UPDATE SET
    status=CASE WHEN email_delivery_log.status IN ('delivered','bounced','complained','suppressed') OR (EXCLUDED.status='queued' AND email_delivery_log.provider_id IS NOT NULL) THEN email_delivery_log.status ELSE EXCLUDED.status END,
    provider_id=COALESCE(EXCLUDED.provider_id,email_delivery_log.provider_id),last_error=EXCLUDED.last_error,updated_at=NOW()`,
  [input.eventKey,input.to.toLowerCase(),input.category ?? "no_reply",input.eventType,input.subject,status,providerId ?? null,error ?? null]);
}
export async function recipientSuppressed(email: string) {
  if (!process.env.DATABASE_URL) return false;
  return (await requirePool().query("SELECT 1 FROM email_suppressions WHERE email=$1",[email.toLowerCase()])).rows.length > 0;
}
export async function applyEmailStatus(providerId: string, status: string) {
  if (["opened","clicked"].includes(status)) status="delivered";
  if (!["sent","delivered","delivery_delayed","bounced","complained","suppressed","failed"].includes(status)) return;
  // Negative terminal events cannot be overwritten by an out-of-order delivered/sent event.
  const result = await requirePool().query(`UPDATE email_delivery_log SET
    status=CASE WHEN status IN ('bounced','complained','suppressed') THEN status
      WHEN status='delivered' AND $2 IN ('sent','delivery_delayed') THEN status ELSE $2 END,
    provider_checked_at=NOW(),updated_at=NOW() WHERE provider_id=$1 RETURNING recipient,status`,[providerId,status]);
  for (const row of result.rows) if (["bounced","complained","suppressed"].includes(row.status)) {
    await requirePool().query("INSERT INTO email_suppressions(email,reason) VALUES($1,$2) ON CONFLICT(email) DO NOTHING",[row.recipient,row.status]);
  }
}
export async function refreshEmailDeliveryStatuses() {
  if (!process.env.RESEND_API_KEY) return 0;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const rows = await requirePool().query(`SELECT provider_id FROM email_delivery_log WHERE provider_id IS NOT NULL
    AND created_at>NOW()-INTERVAL '7 days' AND status NOT IN ('bounced','complained','suppressed','failed')
    AND (provider_checked_at IS NULL OR provider_checked_at<NOW()-INTERVAL '6 hours')
    ORDER BY provider_checked_at NULLS FIRST LIMIT 10`);
  let checked=0;
  for (const row of rows.rows) {
    const result=await resend.emails.get(row.provider_id);
    if (result.error) break; // Stop on rate limits; never infer delivery from a failed lookup.
    await applyEmailStatus(row.provider_id,result.data?.last_event ?? "sent");
    checked++;
    await new Promise(resolve=>setTimeout(resolve,600));
  }
  return checked;
}
export async function retryFailedEmail(eventKey: string) {
  // Only retry unacknowledged sends inside the provider's original idempotency window.
  const result=await requirePool().query(`UPDATE email_outbox e SET status='pending',available_at=NOW(),last_error=NULL
    WHERE e.event_key=$1 AND e.status='failed' AND e.payload IS NOT NULL
    AND e.first_attempt_at>NOW()-INTERVAL '23 hours' AND e.attempts<10
    AND NOT EXISTS(SELECT 1 FROM email_delivery_log l WHERE l.event_key=e.event_key AND
      (l.provider_id IS NOT NULL OR l.status IN ('delivered','bounced','complained','suppressed')))
    AND NOT EXISTS(SELECT 1 FROM notification_deliveries d WHERE d.event_key=e.event_key)
    AND NOT EXISTS(SELECT 1 FROM email_suppressions s WHERE s.email=lower(e.payload->>'to')) RETURNING e.event_key`,[eventKey]);
  if (result.rows.length) await requirePool().query("UPDATE email_delivery_log SET status='queued',last_error=NULL WHERE event_key=$1",[eventKey]);
  return result.rows.length===1;
}
