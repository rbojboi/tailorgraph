import { Pool } from "pg";
import { EMAIL_OUTBOX_SCHEMA } from "../lib/email-outbox-schema";

// The preview environment can share production data. Only the production build
// applies this additive migration, before Vercel promotes the new application.
if (process.env.VERCEL_ENV === "production") {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for the email migration");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(1208224399, 36)");
    const result = await client.query<{ version: number }>("SELECT MAX(version) AS version FROM tailorgraph_schema_migrations");
    if (!result.rows[0]?.version || result.rows[0].version < 35) {
      throw new Error("Apply the existing schema migrations before the email migration");
    }
    await client.query(EMAIL_OUTBOX_SCHEMA);
    await client.query("INSERT INTO tailorgraph_schema_migrations(version) VALUES(36) ON CONFLICT(version) DO NOTHING");
    await client.query("COMMIT");
    console.log("Email outbox schema verified (version 36).");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
