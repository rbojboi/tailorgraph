import assert from "node:assert/strict";
import { test, beforeEach, mock } from "node:test";

const queued = [], sent = [], ledger = new Set();
let providerError = null;
mock.module("resend", { namedExports: { Resend: class {
  emails = { send: async (message, options) => {
    sent.push({ message, options });
    return providerError ? { error: providerError } : { data: { id: "receipt" }, error: null };
  }};
}}});
mock.module(new URL("../lib/store.ts", import.meta.url).href, { namedExports: {
  ensureSchema: async () => {}, requirePool: () => {}, findUserById: async () => null,
  hasNotificationDelivery: async key => ledger.has(key),
  recordNotificationDelivery: async item => ledger.add(item.eventKey)
}});
mock.module(new URL("../lib/stripe.ts", import.meta.url).href, { namedExports: { getAppUrl: () => "https://www.tailorgraph.com" }});
mock.module(new URL("../lib/email-outbox.ts", import.meta.url).href, { namedExports: {
  enqueueEmail: async item => queued.push(item),
  drainEmailOutbox: async () => ({ sent: 0, retried: 0, skipped: 0, failed: 0 }),
  EmailDeliveryError: class extends Error {}
}});
const mail = await import("../lib/notifications.ts");
beforeEach(() => {
  queued.length = 0; sent.length = 0; ledger.clear(); providerError = null;
  process.env.RESEND_API_KEY = "re_fake";
  process.env.EMAIL_FROM = "TailorGraph <noreply@mail.tailorgraph.com>";
});
const buyer = { id: "buyer", email: "buyer@example.com", name: "Buyer", username: "buyer", notificationPreferences: { messagesEmail: true }};
const seller = { id: "seller", email: "seller@example.com", name: "Seller", username: "seller", notificationPreferences: { offerAndPriceDropEmail: true }};
const order = { id: "order", listingTitle: "Wool suit", sellerName: "Seller", amount: 200, subtotal: 180, shippingAmount: 20 };

test("purchase queues a distinct buyer confirmation and seller sale email even before provider setup", async () => {
  delete process.env.RESEND_API_KEY;
  await mail.sendOrderPurchasedNotifications({ buyer, seller, order, listing: null });
  assert.equal(queued.length, 2);
  assert.deepEqual(queued.map(x => x.to), [buyer.email, seller.email]);
  assert.equal(new Set(queued.map(x => x.eventKey)).size, 2);
  for (const item of queued) {
    assert.equal(item.durable, true);
    assert.match(item.html, /TailorGraph/);
    assert.match(item.text, /Wool suit/);
  }
});

test("offer notification honors preference and avoids implying a paid sale", async () => {
  const offer = { id: "offer", listingTitle: "Jacket", amount: 100, buyerUsername: "buyer" };
  await mail.sendOfferReceivedNotification(offer, { ...seller, notificationPreferences: { offerAndPriceDropEmail: false }});
  assert.equal(queued.length, 0);
  await mail.sendOfferReceivedNotification(offer, seller);
  assert.equal(queued.length, 1);
  assert.equal(queued[0].preferenceKey, "offerAndPriceDropEmail");
  assert.match(queued[0].text, /not a paid order/);
  assert.match(queued[0].html, /Email preferences/);
});

test("messages carry the ID and recipient needed to suppress already-read mail", async () => {
  await mail.sendDirectMessageNotification({ messageId: "message", thread: { id: "thread" }, sender: seller, recipient: buyer, body: "<script>test</script>" });
  assert.equal(queued[0].messageId, "message");
  assert.equal(queued[0].recipientUserId, buyer.id);
  assert.equal(queued[0].preferenceKey, "messagesEmail");
  assert.doesNotMatch(queued[0].html, /<script>/);
});

test("fresh password-reset links are delivered; retries of the same link are deduplicated", async () => {
  await mail.sendPasswordResetNotification({ user: buyer, resetUrl: "https://www.tailorgraph.com/reset?token=one" });
  await mail.sendPasswordResetNotification({ user: buyer, resetUrl: "https://www.tailorgraph.com/reset?token=one" });
  await mail.sendPasswordResetNotification({ user: buyer, resetUrl: "https://www.tailorgraph.com/reset?token=two" });
  assert.equal(sent.length, 2);
  assert.notEqual(sent[0].options.idempotencyKey, sent[1].options.idempotencyKey);
  assert.doesNotMatch(sent[0].options.idempotencyKey, /token=one/);
  assert.equal(queued.length, 0);
});

test("provider errors do not record successful delivery", async () => {
  providerError = { name: "rate_limit_exceeded", statusCode: 429 };
  await assert.rejects(mail.sendPasswordResetNotification({ user: buyer, resetUrl: "https://www.tailorgraph.com/reset?token=one" }));
  assert.equal(ledger.size, 0);
});
