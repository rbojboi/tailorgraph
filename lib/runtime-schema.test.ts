import test from "node:test";
import assert from "node:assert/strict";
import { shouldRunRuntimeSchemaInit } from "./runtime-schema";

test("runtime schema initialization is disabled on Vercel production", () => {
  assert.equal(
    shouldRunRuntimeSchemaInit({
      DATABASE_URL: "postgres://example",
      NODE_ENV: "production",
      VERCEL: "1"
    }),
    false
  );
});

test("runtime schema initialization can be explicitly enabled for migration jobs", () => {
  assert.equal(
    shouldRunRuntimeSchemaInit({
      DATABASE_URL: "postgres://example",
      NODE_ENV: "production",
      VERCEL: "1",
      ALLOW_RUNTIME_SCHEMA_INIT: "true"
    }),
    true
  );
});

test("runtime schema initialization is available for local development", () => {
  assert.equal(shouldRunRuntimeSchemaInit({ DATABASE_URL: "postgres://example", NODE_ENV: "development" }), true);
});
