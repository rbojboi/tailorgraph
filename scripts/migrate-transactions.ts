import { Pool } from "pg";
import { TRANSACTION_SCHEMA } from "../lib/transaction-schema";

if (process.env.VERCEL_ENV === "production") {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for transaction migration");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(1208224399,39)");
    const result = await client.query("SELECT MAX(version) AS version FROM tailorgraph_schema_migrations");
    const version = Number(result.rows[0]?.version);
    if (version < 38 || !version) throw new Error("Apply schema 38 before transaction migration");
    if (version < 39) await client.query(TRANSACTION_SCHEMA);
    await client.query("INSERT INTO tailorgraph_schema_migrations(version) VALUES(39) ON CONFLICT DO NOTHING");
    await client.query("COMMIT");
    console.log("Transaction schema verified (version 39).");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); await pool.end(); }
}
