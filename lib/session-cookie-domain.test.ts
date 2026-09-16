import assert from "node:assert/strict";
import test from "node:test";
import { sessionCookieDomain } from "@/lib/session-cookie-domain";

test("preview/local cookies stay host-only while production apex/www sessions still share a domain", () => {
  assert.equal(sessionCookieDomain("production", "production", "https://www.tailorgraph.com"), ".tailorgraph.com");
  assert.equal(sessionCookieDomain("production", undefined, "https://tailorgraph.com"), ".tailorgraph.com");
  assert.equal(sessionCookieDomain("production", "preview", "https://www.tailorgraph.com"), undefined);
  assert.equal(sessionCookieDomain("development", undefined, "https://www.tailorgraph.com"), undefined);
  assert.equal(sessionCookieDomain("production", "production", "https://tailorgraph.com.evil.test"), undefined);
  assert.equal(sessionCookieDomain("production", "production", "invalid"), undefined);
});
