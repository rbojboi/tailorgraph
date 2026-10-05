import { createHash } from "node:crypto";
import { findUserById, requirePool } from "./store";
import { emailFrequency, nextDigestDate } from "./notification-preferences";
import { renderDigestEmail } from "./email-digest-template";
import { getAppUrl } from "./stripe";
import { shouldSkipEmail } from "./email-outbox";
import type { EmailInput } from "./notifications";

export async function deferToDigest(input: EmailInput) {
  if (input.digest || !input.recipientUserId || !input.preferenceKey) return false;
  const user = await findUserById(input.recipientUserId);
  if (!user) return true;
  const frequency = emailFrequency(user.notificationPreferences, input.preferenceKey);
  if (frequency === "off") return true;
  if (frequency === "instant") return false;
  await requirePool().query(`INSERT INTO email_digest_items(event_key,recipient_id,preference_key,payload,available_at)
    VALUES($1,$2,$3,$4::jsonb,$5) ON CONFLICT(event_key) DO NOTHING`,
    [input.eventKey,user.id,input.preferenceKey,JSON.stringify({...input,digestFrequency:frequency}),nextDigestDate(frequency)]);
  await import("./email-monitor").then(({trackEmail})=>trackEmail(input,"digest_pending"));
  return true;
}

export async function flushEmailDigests() {
  const db = requirePool();
  const groups = await db.query(`SELECT recipient_id,preference_key FROM email_digest_items WHERE processed_at IS NULL AND available_at<=NOW()
    GROUP BY recipient_id,preference_key ORDER BY MIN(available_at) LIMIT 10`);
  let count = 0;
  for (const group of groups.rows) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      // One worker per recipient/category, including items added while another worker runs.
      const lock = await client.query("SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked",[`${group.recipient_id}:${group.preference_key}`]);
      if (!lock.rows[0].locked) { await client.query("ROLLBACK"); continue; }
      const rows = await client.query<{event_key:string;payload:EmailInput}>(`SELECT event_key,payload FROM email_digest_items
        WHERE recipient_id=$1 AND preference_key=$2 AND processed_at IS NULL AND available_at<=NOW()
        ORDER BY available_at,event_key FOR UPDATE LIMIT 30`,[group.recipient_id,group.preference_key]);
      const valid: EmailInput[]=[];
      const processed:string[]=[];
      const user=await findUserById(group.recipient_id);
      for (const row of rows.rows) {
        const frequency=user && row.payload.preferenceKey?emailFrequency(user.notificationPreferences,row.payload.preferenceKey):"off";
        if ((frequency==="daily" || frequency==="weekly") && frequency!==row.payload.digestFrequency) {
          await client.query("UPDATE email_digest_items SET available_at=$2,payload=$3::jsonb WHERE event_key=$1",[row.event_key,nextDigestDate(frequency),JSON.stringify({...row.payload,digestFrequency:frequency})]);
          continue;
        }
        processed.push(row.event_key);
        if (!await shouldSkipEmail(row.payload)) valid.push(row.payload);
      }
      if (valid.length) {
        const first=valid[0];
        const eventKey="digest:"+createHash("sha256").update(processed.join("|")).digest("hex");
        const rendered=renderDigestEmail(valid,getAppUrl());
        const {subject}=rendered;
        const payload:EmailInput={eventKey,eventType:"digest",digest:true,recipientUserId:first.recipientUserId,
          preferenceKey:first.preferenceKey,to:first.to,category:first.category,...rendered,
          digestItems:valid};
        await client.query("INSERT INTO email_outbox(event_key,payload) VALUES($1,$2::jsonb) ON CONFLICT(event_key) DO NOTHING",[eventKey,JSON.stringify(payload)]);
        await client.query(`INSERT INTO email_delivery_log(event_key,recipient,category,event_type,subject,status)
          VALUES($1,$2,$3,'digest',$4,'queued') ON CONFLICT(event_key) DO NOTHING`,[eventKey,first.to,first.category??"alerts",subject]);
      }
      if (processed.length) {
        await client.query("UPDATE email_digest_items SET processed_at=NOW(),payload=NULL WHERE event_key=ANY($1::text[])",[processed]);
        await client.query("UPDATE email_delivery_log SET status=CASE WHEN event_key=ANY($2::text[]) THEN 'digested' ELSE 'skipped' END,updated_at=NOW() WHERE event_key=ANY($1::text[])",[processed,valid.map(item=>item.eventKey)]);
      }
      await client.query("COMMIT"); count+=valid.length;
    } catch(error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  return count;
}
