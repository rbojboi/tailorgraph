import { createHmac, timingSafeEqual } from "node:crypto";

type VerificationResult =
  | { ok: true; mode: "signature" | "shared-secret" | "disabled" }
  | { ok: false; status: number; message: string };

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

function parseShippoSignature(header: string) {
  const parts = new Map(
    header
      .split(",")
      .map((part) => part.trim().split("="))
      .filter((pair): pair is [string, string] => pair.length === 2 && Boolean(pair[0]) && Boolean(pair[1]))
  );

  return {
    timestamp: parts.get("t") ?? null,
    signature: parts.get("v1") ?? null
  };
}

export function createShippoSignature(payload: string, timestamp: string, secret: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
}

export function verifyShippoWebhookRequest({
  body,
  headers,
  url,
  env = process.env
}: {
  body: string;
  headers: Headers;
  url: string;
  env?: NodeJS.ProcessEnv;
}): VerificationResult {
  const secret = env.SHIPPO_WEBHOOK_SECRET?.trim();

  if (!secret) {
    if (env.NODE_ENV === "production" || env.VERCEL === "1") {
      return {
        ok: false,
        status: 500,
        message: "SHIPPO_WEBHOOK_SECRET must be configured before Shippo webhooks can mutate orders."
      };
    }

    return { ok: true, mode: "disabled" };
  }

  const signatureHeader = headers.get("shippo-signature") ?? headers.get("Shippo-Signature");
  if (signatureHeader) {
    const { timestamp, signature } = parseShippoSignature(signatureHeader);
    if (!timestamp || !signature) {
      return { ok: false, status: 401, message: "Invalid Shippo webhook signature header." };
    }

    const timestampMs = Number(timestamp) * 1000;
    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
      return { ok: false, status: 401, message: "Expired Shippo webhook signature timestamp." };
    }

    const expected = createShippoSignature(body, timestamp, secret);
    return safeEqual(expected, signature)
      ? { ok: true, mode: "signature" }
      : { ok: false, status: 401, message: "Invalid Shippo webhook signature." };
  }

  const providedSecret =
    headers.get("x-tailorgraph-shippo-webhook-secret") ?? new URL(url).searchParams.get("token");

  if (!providedSecret) {
    return { ok: false, status: 401, message: "Missing Shippo webhook authentication." };
  }

  return safeEqual(secret, providedSecret)
    ? { ok: true, mode: "shared-secret" }
    : { ok: false, status: 401, message: "Invalid Shippo webhook secret." };
}
