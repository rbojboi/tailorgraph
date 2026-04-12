import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { User } from "@/lib/types";
import { findUserById } from "@/lib/store";

const SESSION_COOKIE = "suit_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "suit-yourself-local-secret";

function sign(value: string) {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");
  const attempt = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === attempt.length && timingSafeEqual(expected, attempt);
}

export async function createSession(userId: string) {
  const token = `${userId}.${sign(userId)}`;
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const [userId, signature] = token.split(".");
  if (!userId || !signature || sign(userId) !== signature) {
    return null;
  }

  return findUserById(userId);
}
