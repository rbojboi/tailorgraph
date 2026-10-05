import { Receiver } from "@upstash/qstash";
import { decodeJwt } from "jose";

export const EMAIL_WORKER_URL = "https://www.tailorgraph.com/api/cron/email";
export const EMAIL_HEALTH_URL = "https://www.tailorgraph.com/api/cron/email-health";

/** Verify the original body and canonical destination, including during key rotation. */
export async function authorizeQStash(request: Request, destination: string) {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  const signature = request.headers.get("upstash-signature");
  if (request.method !== "POST" || !currentSigningKey || !nextSigningKey ||
      !signature || signature.length > 16000) return false;
  if (new URL(request.url).pathname !== new URL(destination).pathname ||
      new URL(request.url).search) return false;
  try {
    const body = await request.text();
    if (Buffer.byteLength(body) > 16384) return false;
    // The SDK checks these timestamps when present; require their presence too.
    const claims = decodeJwt(signature);
    if (![claims.exp, claims.nbf, claims.iat].every(value => typeof value === "number")) return false;
    return await new Receiver({ currentSigningKey, nextSigningKey }).verify({
      signature, body, url: destination
    });
  } catch {
    return false;
  }
}

