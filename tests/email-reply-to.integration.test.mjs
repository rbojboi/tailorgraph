import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

const sent = [];
const deliveries = [];
let alreadyDelivered = false;
mock.module("resend", {
  namedExports: {
    Resend: class {
      emails = {
        send: async (message, options) => {
          sent.push({ message, options });
          return { data: { id: "email_test" }, error: null };
        }
      };
    }
  }
});
mock.module(new URL("../lib/store.ts", import.meta.url).href, {
  namedExports: {
    hasNotificationDelivery: async () => alreadyDelivered,
    recordNotificationDelivery: async (delivery) => deliveries.push(delivery)
  }
});
mock.module(new URL("../lib/stripe.ts", import.meta.url).href, {
  namedExports: { getAppUrl: () => "https://example.com" }
});
const { sendReturnEmail, sendSenderTestNotification } = await import("../lib/notifications.ts");

const environmentKeys = [
  "RESEND_API_KEY", "EMAIL_FROM", "EMAIL_FROM_SUPPORT", "EMAIL_FROM_MESSAGES",
  "EMAIL_FROM_NOREPLY", "EMAIL_REPLY_TO", "EMAIL_REPLY_TO_SUPPORT"
];
let savedEnvironment;
beforeEach(() => {
  savedEnvironment = new Map(environmentKeys.map((key) => [key, process.env[key]]));
  for (const key of environmentKeys) delete process.env[key];
  process.env.RESEND_API_KEY = "re_test_not_a_real_key";
  process.env.EMAIL_FROM = "TailorGraph <noreply@mail.tailorgraph.com>";
  sent.length = 0;
  deliveries.length = 0;
  alreadyDelivered = false;
});
afterEach(() => {
  for (const [key, value] of savedEnvironment) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const sendReturn = () => sendReturnEmail(
  "buyer@example.com", "return:test", "Return update", "Your return is on its way.",
  "https://example.com/orders/test"
);
const sendTest = (category) => sendSenderTestNotification({
  to: "tester@example.com", category, runToken: "reply-to-test", skipDedupe: true
});

test("return email uses the support reply inbox ahead of the global override", async () => {
  process.env.EMAIL_REPLY_TO_SUPPORT = "  monitored@example.com  ";
  process.env.EMAIL_REPLY_TO = "general@example.com";
  process.env.EMAIL_FROM_SUPPORT = "TailorGraph Support <support@mail.tailorgraph.com>";
  await sendReturn();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].message.replyTo, "monitored@example.com");
  assert.equal(sent[0].message.from, process.env.EMAIL_FROM_SUPPORT);
  assert.deepEqual(sent[0].message.to, ["buyer@example.com"]);
  assert.deepEqual(sent[0].options, { idempotencyKey: "return:test" });
  assert.equal(deliveries[0].eventType, "return_update");
});

test("support email falls back to the global reply inbox with a valid sender", async () => {
  process.env.EMAIL_REPLY_TO = "  general@example.com  ";
  await sendReturn();
  assert.equal(sent[0].message.replyTo, "general@example.com");
});

test("a blank support override falls back to the global reply inbox", async () => {
  process.env.EMAIL_REPLY_TO_SUPPORT = " \t ";
  process.env.EMAIL_REPLY_TO = "general@example.com";
  await sendReturn();
  assert.equal(sent[0].message.replyTo, "general@example.com");
});

test("support override does not affect other categories", async () => {
  process.env.EMAIL_REPLY_TO_SUPPORT = "monitored@example.com";
  await sendTest("messages");
  assert.equal(sent[0].message.replyTo, "messages@tailorgraph.com");
});

test("the global override also applies to other reply-enabled categories", async () => {
  process.env.EMAIL_REPLY_TO_SUPPORT = "monitored@example.com";
  process.env.EMAIL_REPLY_TO = "general@example.com";
  await sendTest("messages");
  assert.equal(sent[0].message.replyTo, "general@example.com");
});

test("blank overrides preserve the sender-derived root-domain fallback", async () => {
  process.env.EMAIL_REPLY_TO_SUPPORT = " ";
  process.env.EMAIL_REPLY_TO = " ";
  process.env.EMAIL_FROM_SUPPORT = "TailorGraph Support <notifications@mail.example.com>";
  await sendReturn();
  assert.equal(sent[0].message.replyTo, "support@example.com");
});

test("unset overrides preserve the normal support reply address", async () => {
  await sendReturn();
  assert.equal(sent[0].message.replyTo, "support@tailorgraph.com");
});

test("no-reply emails omit Reply-To even when overrides are configured", async () => {
  process.env.EMAIL_REPLY_TO_SUPPORT = "monitored@example.com";
  process.env.EMAIL_REPLY_TO = "general@example.com";
  await sendTest("no_reply");
  assert.equal(sent[0].message.replyTo, undefined);
  assert.match(sent[0].message.text, /without a reply-to address/);
});

test("sender diagnostics report the same reply inbox sent to Resend", async () => {
  process.env.EMAIL_REPLY_TO_SUPPORT = "monitored@example.com";
  await sendTest("support");
  assert.equal(sent[0].message.replyTo, "monitored@example.com");
  assert.match(sent[0].message.text, /Replies should go back to monitored@example.com\./);
  assert.match(sent[0].message.html, /Replies should go back to monitored@example.com\./);
});

test("reply-to configuration preserves notification deduplication", async () => {
  process.env.EMAIL_REPLY_TO_SUPPORT = "monitored@example.com";
  alreadyDelivered = true;
  await sendReturn();
  assert.equal(sent.length, 0);
  assert.equal(deliveries.length, 0);
});
