import type { NotificationPreferences } from "./types";

export const optionalEmailKeys = ["messagesEmail", "fitEmail", "savedSearchEmail", "savedSellerEmail", "savedItemEmail", "offerAndPriceDropEmail", "sellerActivityEmail", "helloEmail", "updatesEmail"] as const;
export type OptionalEmailKey = typeof optionalEmailKeys[number];
export type EmailFrequency = "instant" | "daily" | "weekly" | "off";
export function isOptionalEmailKey(value: string): value is OptionalEmailKey {
  return (optionalEmailKeys as readonly string[]).includes(value);
}
export function emailFrequency(preferences: NotificationPreferences, key: OptionalEmailKey): EmailFrequency {
  if (!preferences[key]) return "off";
  const value = preferences.emailFrequency?.[key];
  return value === "daily" || value === "weekly" || value === "off" ? value : "instant";
}
export function nextDigestDate(frequency: "daily" | "weekly", now = new Date()) {
  const next = new Date(now);
  next.setUTCHours(9, 0, 0, 0);
  if (frequency === "weekly") {
    next.setUTCDate(next.getUTCDate() + (8 - next.getUTCDay()) % 7);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 7);
  } else if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
