import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { SignJWT } from "jose";
import { authorizeQStash, EMAIL_WORKER_URL, EMAIL_HEALTH_URL } from "./qstash-auth";

test("QStash accepts both signing keys and binds signatures to the destination and body", async () => {
  process.env.QSTASH_CURRENT_SIGNING_KEY = "test-current-signing-key";
  process.env.QSTASH_NEXT_SIGNING_KEY = "test-next-signing-key";
  const sign = (key = process.env.QSTASH_CURRENT_SIGNING_KEY!, url = EMAIL_WORKER_URL, body = "{}", exp = "5m") =>
    new SignJWT({ body: createHash("sha256").update(body).digest("base64url") })
      .setProtectedHeader({ alg: "HS256" }).setIssuer("Upstash").setSubject(url)
      .setIssuedAt().setNotBefore(0).setExpirationTime(exp).sign(new TextEncoder().encode(key));
  const request = (signature: string, body = "{}", url = EMAIL_WORKER_URL, method = "POST") =>
    new Request(url, { method, headers: { "upstash-signature": signature }, ...(method === "POST" ? { body } : {}) });
  try {
    const valid = await sign();
    assert.equal(await authorizeQStash(request(valid), EMAIL_WORKER_URL), true);
    assert.equal(await authorizeQStash(request(await sign(process.env.QSTASH_NEXT_SIGNING_KEY)), EMAIL_WORKER_URL), true);
    assert.equal(await authorizeQStash(request(await sign("wrong")), EMAIL_WORKER_URL), false);
    assert.equal(await authorizeQStash(request(valid, '{"changed":true}'), EMAIL_WORKER_URL), false);
    assert.equal(await authorizeQStash(request(valid, "{}", EMAIL_HEALTH_URL), EMAIL_HEALTH_URL), false);
    assert.equal(await authorizeQStash(request(valid, "{}", EMAIL_HEALTH_URL), EMAIL_WORKER_URL), false);
    assert.equal(await authorizeQStash(request(await sign(undefined, undefined, undefined, "-1s")), EMAIL_WORKER_URL), false);
    assert.equal(await authorizeQStash(request("invalid"), EMAIL_WORKER_URL), false);
    assert.equal(await authorizeQStash(request(valid, "{}", EMAIL_WORKER_URL, "GET"), EMAIL_WORKER_URL), false);
    assert.equal(await authorizeQStash(request(valid, "{}", EMAIL_WORKER_URL + "?test=1"), EMAIL_WORKER_URL), false);
    const missingExpiry = await new SignJWT({body:createHash("sha256").update("{}").digest("base64url")})
      .setProtectedHeader({alg:"HS256"}).setIssuer("Upstash").setSubject(EMAIL_WORKER_URL)
      .sign(new TextEncoder().encode(process.env.QSTASH_CURRENT_SIGNING_KEY));
    assert.equal(await authorizeQStash(request(missingExpiry), EMAIL_WORKER_URL), false);
    delete process.env.QSTASH_CURRENT_SIGNING_KEY;
    assert.equal(await authorizeQStash(request(valid), EMAIL_WORKER_URL), false);
  } finally {
    delete process.env.QSTASH_CURRENT_SIGNING_KEY;
    delete process.env.QSTASH_NEXT_SIGNING_KEY;
  }
});

