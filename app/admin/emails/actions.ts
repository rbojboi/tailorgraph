"use server";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { retryFailedEmail, refreshEmailDeliveryStatuses } from "@/lib/email-monitor";
import { redirect } from "next/navigation";

export async function retryEmailAction(form: FormData) {
  if (!isAdminUser(await getCurrentUser())) throw new Error("Admin access required");
  const retried=await retryFailedEmail(String(form.get("eventKey") ?? ""));
  redirect(`/admin/emails?notice=${retried ? "queued" : "review"}`);
}
export async function refreshEmailStatusAction() {
  if (!isAdminUser(await getCurrentUser())) throw new Error("Admin access required");
  await refreshEmailDeliveryStatuses();
  redirect("/admin/emails?notice=refreshed");
}
