export function areDebugRoutesEnabled(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === "production" || env.VERCEL === "1") {
    return false;
  }

  return env.ENABLE_DEBUG_ROUTES !== "false";
}
