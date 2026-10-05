import assert from "node:assert/strict";
import { test } from "node:test";
import { checkEmailWorkerHealth, emailWorkerHealth } from "./email-worker-health";

const now = Date.parse("2026-10-05T12:30:00Z");
test("worker health distinguishes recent, stale, missing and invalid timestamps", () => {
  assert.equal(emailWorkerHealth(new Date(now - 300000), now).healthy, true);
  assert.equal(emailWorkerHealth(new Date(now - 600000), now).healthy, true);
  for (const value of [null, "invalid", new Date(now - 600001), new Date(now + 120000)]) {
    assert.equal(emailWorkerHealth(value, now).healthy, false);
  }
});
test("watchdog bypasses healthy runs and alerts on stale or unavailable storage", async () => {
  const alerts: unknown[] = [];
  const alert = async (health: unknown) => { alerts.push(health); return 1; };
  assert.equal((await checkEmailWorkerHealth(async () => new Date(now), alert, now)).alerted, 0);
  assert.equal(alerts.length, 0);
  assert.equal((await checkEmailWorkerHealth(async () => null, alert, now)).reason, "stale");
  assert.equal((await checkEmailWorkerHealth(async () => { throw new Error("db unavailable"); }, alert, now)).reason, "unavailable");
  assert.equal(alerts.length, 2);
});
test("watchdog propagates provider failures so QStash can retry", async () => {
  await assert.rejects(checkEmailWorkerHealth(async () => null, async () => { throw new Error("provider down"); }, now), /provider down/);
});

