import assert from "node:assert/strict";
import { test } from "node:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { authorizeEmailWorker, EMAIL_WORKER_AUDIENCE } from "./email-worker-auth";

test("email worker verifies signed GitHub identity and rejects unrelated jobs", async () => {
  delete process.env.CRON_SECRET;
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const keys = createLocalJWKSet({ keys: [{ ...await exportJWK(publicKey), kid: "test", alg: "RS256" }] });
  const claims = {
    repository_id: "1208224399", repository_owner_id: "229847007", repository: "rbojboi/tailorgraph",
    ref: "refs/heads/main", workflow_ref: "rbojboi/tailorgraph/.github/workflows/email-worker.yml@refs/heads/main",
    event_name: "schedule"
  };
  const sign = (overrides = {}, audience = EMAIL_WORKER_AUDIENCE, expires = "5m") =>
    new SignJWT({ ...claims, ...overrides }).setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuer("https://token.actions.githubusercontent.com").setSubject("repo:rbojboi/tailorgraph:ref:refs/heads/main")
      .setAudience(audience).setIssuedAt().setNotBefore(0).setExpirationTime(expires).sign(privateKey);
  const request = (token: string) => new Request(EMAIL_WORKER_AUDIENCE, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(await authorizeEmailWorker(request(await sign()), keys), true);
  assert.equal(await authorizeEmailWorker(request(await sign({ event_name: "workflow_dispatch" })), keys), true);
  for (const override of [
    { repository_id: "999" }, { repository_owner_id: "999" }, { repository: "attacker/tailorgraph" },
    { ref: "refs/heads/preview" }, { workflow_ref: "rbojboi/tailorgraph/.github/workflows/ci.yml@refs/heads/main" },
    { event_name: "pull_request" }
  ]) assert.equal(await authorizeEmailWorker(request(await sign(override)), keys), false);
  assert.equal(await authorizeEmailWorker(request(await sign({}, "wrong")), keys), false);
  assert.equal(await authorizeEmailWorker(request(await sign({}, EMAIL_WORKER_AUDIENCE, "-1s")), keys), false);
  const forged = (await sign()).split(".");
  forged[1] = Buffer.from(JSON.stringify({ ...claims, exp: 9999999999 })).toString("base64url");
  assert.equal(await authorizeEmailWorker(request(forged.join(".")), keys), false);
  assert.equal(await authorizeEmailWorker(request("not-a-jwt"), keys), false);
});
