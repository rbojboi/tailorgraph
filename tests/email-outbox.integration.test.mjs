import assert from "node:assert/strict";
import { test, before, beforeEach, after, mock } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { EMAIL_OUTBOX_SCHEMA } from "../lib/email-outbox-schema.ts";

const db = new PGlite();
const pool = { query: async (sql, args = []) => {
  const result = args.length ? await db.query(sql, args) : (await db.exec(sql)).at(-1);
  return { rows: result?.rows ?? [], rowCount: result?.affectedRows ?? 0 };
}};
let recipient;
mock.module(new URL("../lib/store.ts", import.meta.url).href, { namedExports: {
  ensureSchema: async () => {}, requirePool: () => pool,
  findUserById: async () => recipient
}});
const { enqueueEmail, drainEmailOutbox, EmailDeliveryError } = await import("../lib/email-outbox.ts");
before(async () => {
  await db.exec(EMAIL_OUTBOX_SCHEMA);
  await db.exec("CREATE TABLE message_threads(id TEXT, buyer_id TEXT,seller_id TEXT,buyer_last_read_at TIMESTAMPTZ,seller_last_read_at TIMESTAMPTZ); CREATE TABLE messages(id TEXT,thread_id TEXT,created_at TIMESTAMPTZ);");
});
after(() => db.close());
beforeEach(async () => {
  await db.exec("TRUNCATE email_outbox, messages, message_threads;");
  recipient = { email: "buyer@example.com", notificationPreferences: { messagesEmail: true } };
});
const input = (extra = {}) => ({
  eventKey: "purchase:one:buyer_email", eventType: "purchase_confirmation",
  to: "buyer@example.com", subject: "Purchase confirmed", html: "<p>Confirmed</p>", text: "Confirmed", ...extra
});
const row = async () => (await pool.query("SELECT * FROM email_outbox")).rows[0];

test("duplicate enqueues preserve original payload; successful jobs send once and erase content", async () => {
  await enqueueEmail(input());
  await enqueueEmail(input({ subject: "Changed later" }));
  let count = 0;
  const send = async message => { count++; assert.equal(message.subject, "Purchase confirmed"); };
  assert.equal((await drainEmailOutbox(send)).sent, 1);
  await drainEmailOutbox(send);
  assert.equal(count, 1);
  assert.equal((await row()).payload, null);
  assert.equal((await row()).status, "sent");
});

test("transient provider failure stays pending with backoff and succeeds on retry", async () => {
  await enqueueEmail(input());
  const result = await drainEmailOutbox(async () => { throw new EmailDeliveryError("rate_limit_exceeded", true); });
  assert.equal(result.retried, 1);
  assert.equal((await row()).status, "pending");
  assert.ok(new Date((await row()).available_at) > new Date());
  await pool.query("UPDATE email_outbox SET available_at=NOW()-INTERVAL '1 second'");
  assert.equal((await drainEmailOutbox(async () => {})).sent, 1);
});

test("invalid recipient failures stop automatic retries", async () => {
  await enqueueEmail(input());
  assert.equal((await drainEmailOutbox(async () => { throw new EmailDeliveryError("validation_error", false); })).failed, 1);
  assert.equal((await row()).status, "failed");
});

test("workers cannot claim a currently leased job; expired leases recover with same key", async () => {
  await enqueueEmail(input());
  let finish;
  let started;
  const entered = new Promise(resolve => { started = resolve; });
  const blocker = new Promise(resolve => { finish = resolve; });
  const running = drainEmailOutbox(async () => { started(); await blocker; });
  await entered;
  assert.equal((await drainEmailOutbox(async () => assert.fail("Concurrent send"))).sent, 0);
  finish(); await running;
  await pool.query("UPDATE email_outbox SET status='sending',payload=$1::jsonb,leased_until=NOW()-INTERVAL '1 minute'", [JSON.stringify(input())]);
  await drainEmailOutbox(async message => assert.equal(message.eventKey, input().eventKey));
  assert.equal((await row()).status, "sent");
});

test("a crash older than the provider idempotency window requires review", async () => {
  await enqueueEmail(input());
  await pool.query("UPDATE email_outbox SET first_attempt_at=NOW()-INTERVAL '24 hours'");
  assert.equal((await drainEmailOutbox(async () => assert.fail("Unsafe retry"))).failed, 1);
});

test("optional preferences and changed recipient addresses are checked again at delivery", async () => {
  await enqueueEmail(input({ recipientUserId: "buyer", preferenceKey: "messagesEmail" }));
  recipient.notificationPreferences.messagesEmail = false;
  assert.equal((await drainEmailOutbox(async () => assert.fail("Opted out"))).skipped, 1);
  await enqueueEmail(input({ eventKey: "another", recipientUserId: "buyer" }));
  recipient.email = "new@example.com";
  assert.equal((await drainEmailOutbox(async () => assert.fail("Old address"))).skipped, 1);
});

test("message emails wait and are suppressed when the conversation was read", async () => {
  await enqueueEmail(input({ messageId: "message", recipientUserId: "buyer", preferenceKey: "messagesEmail" }));
  assert.equal((await drainEmailOutbox(async () => assert.fail("Too early"))).sent, 0);
  await pool.query("INSERT INTO message_threads VALUES('thread','buyer','seller',NOW(),NULL)");
  await pool.query("INSERT INTO messages VALUES('message','thread',NOW()-INTERVAL '1 minute')");
  await pool.query("UPDATE email_outbox SET available_at=NOW()-INTERVAL '1 second'");
  assert.equal((await drainEmailOutbox(async () => assert.fail("Already read"))).skipped, 1);
});
