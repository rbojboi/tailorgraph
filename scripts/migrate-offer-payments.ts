import { Pool } from "pg";
import { COMMERCE_SCHEMA } from "../lib/commerce-schema";

if (process.env.VERCEL_ENV === "production") {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for offer payments migration");
  const pool=new Pool({connectionString:process.env.DATABASE_URL});
  const client=await pool.connect();
  try {
    await client.query("BEGIN");await client.query("SELECT pg_advisory_xact_lock(1208224399,38)");
    const result=await client.query("SELECT MAX(version) AS version FROM tailorgraph_schema_migrations");
    if (!result.rows[0]?.version || Number(result.rows[0].version)<37) throw new Error("Apply schema 37 before offer payments");
    if (Number(result.rows[0]?.version)<38) await client.query(COMMERCE_SCHEMA);
    await client.query("INSERT INTO tailorgraph_schema_migrations(version) VALUES(38) ON CONFLICT DO NOTHING");
    await client.query("COMMIT");console.log("Offer payment schema verified (version 38).");
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();await pool.end();}
}
