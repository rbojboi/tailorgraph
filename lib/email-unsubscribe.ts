import { createHmac, timingSafeEqual } from "node:crypto";
import { isOptionalEmailKey, type OptionalEmailKey } from "./notification-preferences";

function secret() {
  const value = process.env.EMAIL_UNSUBSCRIBE_SECRET || process.env.SESSION_SECRET;
  if (!value) throw new Error("Email unsubscribe signing secret is not configured");
  return value;
}
export function unsubscribeToken(userId: string, email: string, key: OptionalEmailKey) {
  const payload = Buffer.from(JSON.stringify({ userId, email: email.toLowerCase(), key })).toString("base64url");
  return `${payload}.${createHmac("sha256",secret()).update(payload).digest("base64url")}`;
}
export function readUnsubscribeToken(token: string) {
  try {
    if (token.length > 2048) return null;
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return null;
    const expected = createHmac("sha256",secret()).update(payload).digest();
    const actual = Buffer.from(signature,"base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const data = JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));
    if (typeof data.userId !== "string" || typeof data.email !== "string" || !isOptionalEmailKey(data.key)) return null;
    return data as {userId:string;email:string;key:OptionalEmailKey};
  } catch { return null; }
}
