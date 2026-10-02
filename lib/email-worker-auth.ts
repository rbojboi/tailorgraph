import { timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

const issuer = "https://token.actions.githubusercontent.com";
const githubKeys = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks`));
export const EMAIL_WORKER_AUDIENCE = "https://www.tailorgraph.com/api/cron/email";

export async function authorizeEmailWorker(request: Request, keys: JWTVerifyGetKey = githubKeys) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const token = header.slice(7);
  const secret = process.env.CRON_SECRET;
  if (secret && Buffer.byteLength(token) === Buffer.byteLength(secret) &&
      timingSafeEqual(Buffer.from(token), Buffer.from(secret))) return true;
  if (token.length > 16000 || token.split(".").length !== 3) return false;
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer, audience: EMAIL_WORKER_AUDIENCE, algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "nbf", "sub"], maxTokenAge: "10m"
    });
    // Immutable IDs prevent a renamed/transferred repository from inheriting access.
    return payload.repository_id === "1208224399" && payload.repository_owner_id === "229847007" &&
      payload.repository === "rbojboi/tailorgraph" && payload.ref === "refs/heads/main" &&
      payload.workflow_ref === "rbojboi/tailorgraph/.github/workflows/email-worker.yml@refs/heads/main" &&
      (payload.event_name === "schedule" || payload.event_name === "workflow_dispatch");
  } catch {
    return false;
  }
}
