import { deferToDigest } from "./email-digests";
import { trackEmail } from "./email-monitor";
import { emailFrequency } from "./notification-preferences";
import { renderDigestEmail } from "./email-digest-template";
import { getAppUrl } from "./stripe";
import { randomUUID } from "node:crypto";
import { ensureSchema, findUserById, requirePool } from "@/lib/store";
import type { EmailInput } from "@/lib/notifications";


export async function enqueueEmail(input: EmailInput) {
  await ensureSchema();
  if (await deferToDigest(input)) return;
  await trackEmail(input,"queued");
  await requirePool().query(
    `INSERT INTO email_outbox(event_key,payload,available_at) VALUES($1,$2::jsonb,NOW()+($3 * INTERVAL '1 second'))
     ON CONFLICT(event_key) DO NOTHING`,
    [input.eventKey, JSON.stringify(input), input.messageId ? 120 : 0]
  );
}

type Job = {
  event_key: string;
  payload: EmailInput;
  attempts: number;
  first_attempt_at: Date;
  lease_token: string;
};

export async function shouldSkipEmail(input: EmailInput) {
  if(input.requirePaidOrder && input.orderId) {
    const order=await requirePool().query("SELECT status FROM orders WHERE id=$1",[input.orderId]);
    if(!order.rows[0] || !['paid','processing','shipped','delivered'].includes(order.rows[0].status)) return true;
  }
  if(input.offerId && input.offerPaymentState) {
    const offer=await requirePool().query("SELECT payment_state FROM offers WHERE id=$1",[input.offerId]);
    if(offer.rows[0]?.payment_state!==input.offerPaymentState) return true;
  }
  if (input.recipientUserId) {
    const user = await findUserById(input.recipientUserId);
    // Never send an old account's queued content after its email address changes.
    if (!user || user.email.toLowerCase() !== input.to.toLowerCase()) return true;
    if (input.preferenceKey && emailFrequency(user.notificationPreferences,input.preferenceKey)==="off") return true;
  }
  if (input.messageId && input.recipientUserId) {
    const result = await requirePool().query<{ unread: boolean }>(
      `SELECT CASE WHEN t.buyer_id=$2 THEN
         (t.buyer_last_read_at IS NULL OR t.buyer_last_read_at < m.created_at)
       WHEN t.seller_id=$2 THEN
         (t.seller_last_read_at IS NULL OR t.seller_last_read_at < m.created_at)
       ELSE FALSE END AS unread
       FROM messages m JOIN message_threads t ON t.id=m.thread_id WHERE m.id=$1`,
      [input.messageId, input.recipientUserId]
    );
    if (!result.rows[0]?.unread) return true;
  }
  if (input.requireUnshipped && input.orderId) {
    const result=await requirePool().query("SELECT 1 FROM orders WHERE id=$1 AND status IN ('paid','processing') AND shipped_at IS NULL",[input.orderId]);
    if (!result.rows.length) return true;
  }
  if (input.listingId) {
    const result=await requirePool().query("SELECT price FROM listings WHERE id=$1 AND status='active'",[input.listingId]);
    if (!result.rows.length || (input.maximumPrice!==undefined && Number(result.rows[0].price)>input.maximumPrice)) return true;
    if (input.requireSavedItem && !(await requirePool().query("SELECT 1 FROM user_saved_listings WHERE user_id=$1 AND listing_id=$2",[input.recipientUserId,input.listingId])).rows.length) return true;
    if (input.savedSearchId && !(await requirePool().query("SELECT 1 FROM user_saved_searches WHERE id=$1 AND user_id=$2",[input.savedSearchId,input.recipientUserId])).rows.length) return true;
  }
  return false;
}

/** Leased claims prevent parallel workers from sending the same job concurrently.
 * The provider also receives a stable idempotency key for crash recovery.
 */
export async function drainEmailOutbox(send: (input: EmailInput) => Promise<void>, eventKey?: string) {
  await ensureSchema();
  const db = requirePool();
  const counts = { sent: 0, skipped: 0, retried: 0, failed: 0 };
  for (let index = 0; index < (eventKey ? 1 : 10); index++) {
    const lease = randomUUID();
    const result = await db.query<Job>(
      `WITH candidate AS (
         SELECT event_key FROM email_outbox
         WHERE ($1::text IS NULL OR event_key=$1)
           AND ((status='pending' AND available_at<=NOW()) OR (status='sending' AND leased_until<NOW()))
         ORDER BY available_at,created_at FOR UPDATE SKIP LOCKED LIMIT 1
       )
       UPDATE email_outbox e SET status='sending', lease_token=$2, leased_until=NOW()+INTERVAL '5 minutes',
         attempts=attempts+1, first_attempt_at=COALESCE(first_attempt_at,NOW())
       FROM candidate c WHERE e.event_key=c.event_key RETURNING e.*`,
      [eventKey ?? null, lease]
    );
    const job = result.rows[0];
    if (!job) break;
    try {
      if (Date.now() - new Date(job.first_attempt_at).getTime() >= 23 * 60 * 60 * 1000) {
        // Resend only remembers keys for 24 hours. Require review instead of risking a duplicate.
        await db.query("UPDATE email_outbox SET status='failed',last_error='Idempotency window expired; review provider delivery before retrying',leased_until=NULL WHERE event_key=$1 AND lease_token=$2", [job.event_key, lease]);
        await trackEmail(job.payload,"failed",undefined,"Idempotency window expired");
        counts.failed++;
        continue;
      }
      if (job.payload.digestItems && job.attempts===1) {
        const items:EmailInput[]=[];
        for (const item of job.payload.digestItems) if (!await shouldSkipEmail(item)) items.push(item);
        job.payload.digestItems=items;
        Object.assign(job.payload,renderDigestEmail(items,getAppUrl()));
        await db.query("UPDATE email_outbox SET payload=$3::jsonb WHERE event_key=$1 AND lease_token=$2",[job.event_key,lease,JSON.stringify(job.payload)]);
      }
      const skipped = (job.payload.digestItems?.length===0) || await shouldSkipEmail(job.payload) || (job.attempts===1 && await deferToDigest(job.payload));
      if (skipped) await trackEmail(job.payload,"skipped");
      if (!skipped) await send(job.payload);
      await db.query(
        "UPDATE email_outbox SET status=$3,payload=NULL,completed_at=NOW(),leased_until=NULL,last_error=NULL WHERE event_key=$1 AND lease_token=$2",
        [job.event_key, lease, skipped ? "skipped" : "sent"]
      );
      counts[skipped ? "skipped" : "sent"]++;
    } catch (error) {
      const permanent = error instanceof EmailDeliveryError && !error.retryable;
      const failed = permanent || job.attempts >= 10;
      await trackEmail(job.payload,failed?"failed":"retrying",undefined,error instanceof EmailDeliveryError?error.code:"delivery_or_storage_error");
      // Store only an error class, never provider messages that may echo recipient/content.
      await db.query(
        `UPDATE email_outbox SET status=$3,leased_until=NULL,last_error=$4,
         available_at=NOW()+($5 * INTERVAL '1 second') WHERE event_key=$1 AND lease_token=$2`,
        [job.event_key, lease, failed ? "failed" : "pending",
          error instanceof EmailDeliveryError ? error.code : "delivery_or_storage_error",
          Math.min(3600, 60 * 2 ** (job.attempts - 1))]
      );
      counts[failed ? "failed" : "retried"]++;
    }
  }
  return counts;
}

export class EmailDeliveryError extends Error {
  code: string;
  retryable: boolean;
  constructor(code: string, retryable: boolean) {
    super("Email provider did not accept the message");
    this.code = code;
    this.retryable = retryable;
  }
}
