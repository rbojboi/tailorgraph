import test from "node:test";
import assert from "node:assert/strict";
import { createShippoSignature, verifyShippoWebhookRequest } from "./shippo-webhook-auth";

const body = JSON.stringify({ event: "track_updated", data: { object_id: "tx_123" } });
const url = "https://www.tailorgraph.com/api/shippo/webhook";

test("Shippo webhook auth accepts a valid shared secret", () => {
  const headers = new Headers({ "x-tailorgraph-shippo-webhook-secret": "secret-123" });
  const result = verifyShippoWebhookRequest({
    body,
    headers,
    url,
    env: { SHIPPO_WEBHOOK_SECRET: "secret-123", NODE_ENV: "production", VERCEL: "1" }
  });

  assert.deepEqual(result, { ok: true, mode: "shared-secret" });
});

test("Shippo webhook auth accepts a valid signature", () => {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createShippoSignature(body, timestamp, "secret-123");
  const headers = new Headers({ "shippo-signature": `t=${timestamp},v1=${signature}` });
  const result = verifyShippoWebhookRequest({
    body,
    headers,
    url,
    env: { SHIPPO_WEBHOOK_SECRET: "secret-123", NODE_ENV: "production", VERCEL: "1" }
  });

  assert.deepEqual(result, { ok: true, mode: "signature" });
});

test("Shippo webhook auth rejects missing authentication", () => {
  const result = verifyShippoWebhookRequest({
    body,
    headers: new Headers(),
    url,
    env: { SHIPPO_WEBHOOK_SECRET: "secret-123", NODE_ENV: "production", VERCEL: "1" }
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test("Shippo webhook auth rejects invalid authentication", () => {
  const headers = new Headers({ "x-tailorgraph-shippo-webhook-secret": "wrong" });
  const result = verifyShippoWebhookRequest({
    body,
    headers,
    url,
    env: { SHIPPO_WEBHOOK_SECRET: "secret-123", NODE_ENV: "production", VERCEL: "1" }
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});
