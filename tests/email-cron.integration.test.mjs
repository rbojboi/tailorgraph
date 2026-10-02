import assert from "node:assert/strict";
import { test, mock } from "node:test";

let calls = 0;
let configured = true;
mock.module(new URL("../lib/notifications.ts", import.meta.url).href, {
  namedExports: { deliverPendingEmails: async () => {
    calls++;
    return { configured, sent: 1, skipped: 0, retried: 0, failed: 0 };
  }}
});
const { GET } = await import("../app/api/cron/email/route.ts");
test("email worker fails closed without a secret or with a bad authorization header", async () => {
  delete process.env.CRON_SECRET;
  assert.equal((await GET(new Request("https://example.com/api/cron/email"))).status, 401);
  process.env.CRON_SECRET = "test-secret";
  assert.equal((await GET(new Request("https://example.com/api/cron/email", { headers: { authorization: "Bearer wrong" } }))).status, 401);
  assert.equal(calls, 0);
});
test("authorized worker returns counts; missing mail setup is not reported as success", async () => {
  process.env.CRON_SECRET = "test-secret";
  const request = () => new Request("https://example.com/api/cron/email", { headers: { authorization: "Bearer test-secret" } });
  const result = await GET(request());
  assert.equal(result.status, 200);
  assert.equal((await result.json()).sent, 1);
  configured = false;
  assert.equal((await GET(request())).status, 503);
});
