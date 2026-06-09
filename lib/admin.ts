import type { User } from "@/lib/types";

export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(user: User | null) {
  if (!user) {
    return false;
  }

  return user.isAdmin || getAdminEmails().includes(user.email.toLowerCase());
}
