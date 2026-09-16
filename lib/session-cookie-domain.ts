export function sessionCookieDomain(nodeEnv: string | undefined, vercelEnv: string | undefined, appUrl: string | undefined) {
  // Production builds also run on preview hosts, which cannot set cookies for
  // tailorgraph.com. Keep previews host-only; retain apex/www sharing in prod.
  if (nodeEnv !== "production" || vercelEnv === "preview" || !appUrl) return undefined;
  try {
    const host = new URL(appUrl).hostname;
    return host === "tailorgraph.com" || host === "www.tailorgraph.com" ? ".tailorgraph.com" : undefined;
  } catch { return undefined; }
}
