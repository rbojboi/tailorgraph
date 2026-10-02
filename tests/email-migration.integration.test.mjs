import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("production email migration is additive, repeatable, and records version 36", async () => {
  const db = new PGlite();
  await db.exec("CREATE TABLE tailorgraph_schema_migrations(version INTEGER PRIMARY KEY); INSERT INTO tailorgraph_schema_migrations VALUES(35); CREATE TABLE existing_data(id INTEGER); INSERT INTO existing_data VALUES(7)");
  let closed = 0;
  const client = {
    query: async (sql) => sql.includes("pg_advisory_xact_lock") ? { rows: [] } :
      (await db.exec(sql)).at(-1), release() {}
  };
  mock.module("pg", { namedExports: { Pool: class {
    async connect() { return client; }
    async end() { closed++; }
  } } });
  process.env.VERCEL_ENV = "production";
  process.env.DATABASE_URL = "postgres://unused-in-test";
  try {
    await import("../scripts/migrate-email-outbox.ts?first");
    await import("../scripts/migrate-email-outbox.ts?second");
    assert.equal((await db.query("SELECT MAX(version) AS version FROM tailorgraph_schema_migrations")).rows[0].version, 36);
    assert.equal((await db.query("SELECT id FROM existing_data")).rows[0].id, 7);
    assert.equal((await db.query("SELECT count(*)::int AS count FROM email_outbox")).rows[0].count, 0);
    assert.equal(closed, 2);
  } finally {
    delete process.env.VERCEL_ENV;
    delete process.env.DATABASE_URL;
    await db.close();
  }
});
