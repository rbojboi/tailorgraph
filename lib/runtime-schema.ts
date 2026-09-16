export const CURRENT_SCHEMA_VERSION = 35;

export function shouldRunRuntimeSchemaInit(env: NodeJS.ProcessEnv = process.env) {
  if (!env.DATABASE_URL) {
    return false;
  }

  if (env.ALLOW_RUNTIME_SCHEMA_INIT === "true") {
    return true;
  }

  return env.NODE_ENV !== "production" && env.VERCEL !== "1";
}

export function getRuntimeSchemaDisabledMessage() {
  return [
    "Runtime schema initialization is disabled in production.",
    "Run `npm run db:migrate` during deployment or set ALLOW_RUNTIME_SCHEMA_INIT=true only for a controlled migration."
  ].join(" ");
}
