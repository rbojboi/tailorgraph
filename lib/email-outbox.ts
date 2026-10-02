import { randomUUID } from "node:crypto";
import { ensureSchema, findUserById, requirePool } from "@/lib/store";
import type { EmailInput } from "@/lib/notifications";


export async function enqueueEmail(input: EmailInput) {
  await ensureSchema();
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

async function shouldSkip(input: EmailInput) {
  if (input.recipientUserId) {
    const user = await findUserById(input.recipientUserId);
    // Never send an old account's queued content after its email address changes.
    if (!user || user.email.toLowerCase() !== input.to.toLowerCase()) return true;
    if (input.preferenceKey && !user.notificationPreferences[input.preferenceKey]) return true;
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
        counts.failed++;
        continue;
      }
      const skipped = await shouldSkip(job.payload);
      if (!skipped) await send(job.payload);
      await db.query(
        "UPDATE email_outbox SET status=$3,payload=NULL,completed_at=NOW(),leased_until=NULL,last_error=NULL WHERE event_key=$1 AND lease_token=$2",
        [job.event_key, lease, skipped ? "skipped" : "sent"]
      );
      counts[skipped ? "skipped" : "sent"]++;
    } catch (error) {
      const permanent = error instanceof EmailDeliveryError && !error.retryable;
      const failed = permanent || job.attempts >= 10;
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
