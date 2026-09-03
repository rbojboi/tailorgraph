import { runSchemaMigrationsForDeployment } from "../lib/store";

await runSchemaMigrationsForDeployment();
console.log("TailorGraph database migration completed.");
