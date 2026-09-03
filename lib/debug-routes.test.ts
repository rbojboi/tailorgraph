import test from "node:test";
import assert from "node:assert/strict";
import { areDebugRoutesEnabled } from "./debug-routes";

test("debug routes are disabled in production by default", () => {
  assert.equal(areDebugRoutesEnabled({ NODE_ENV: "production", VERCEL: "1" }), false);
});

test("debug routes cannot be enabled in production by env flag", () => {
  assert.equal(areDebugRoutesEnabled({ NODE_ENV: "production", VERCEL: "1", ENABLE_DEBUG_ROUTES: "true" }), false);
});

test("debug routes remain available in local development", () => {
  assert.equal(areDebugRoutesEnabled({ NODE_ENV: "development" }), true);
});

test("debug routes can be disabled in local development", () => {
  assert.equal(areDebugRoutesEnabled({ NODE_ENV: "development", ENABLE_DEBUG_ROUTES: "false" }), false);
});
