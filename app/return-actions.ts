"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { acceptReturnedItem, disputeReturnedItem, processReturn, recoverReturnLabel, reviewReturnDispute, requestReturn } from "@/lib/returns";
import { deliverReturnNotifications } from "@/lib/return-notifications";

export async function updateReturnAction(form: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const orderId = String(form.get("orderId") || "");
  const action = String(form.get("action") || "");
  const admin = isAdminUser(user);
  const seller = ["accept", "dispute"].includes(action);
  const target = admin && ["retry", "recover_label", "review"].includes(action) ? "/admin/returns" : `/${seller ? "seller" : "buyer"}/orders/${encodeURIComponent(orderId)}/return`;
  try {
    if (action === "request") await requestReturn(orderId, user.id);
    else if (action === "accept") await acceptReturnedItem(orderId, user.id);
    else if (action === "dispute") await disputeReturnedItem(orderId, user.id, String(form.get("details") || ""), String(form.get("evidence") || ""));
    else if (admin && action === "retry") await processReturn(orderId);
    else if (admin && action === "recover_label") await recoverReturnLabel(orderId, String(form.get("transactionId") || ""));
    else if (admin && action === "review") await reviewReturnDispute(orderId, String(form.get("outcome") || ""), String(form.get("notes") || ""), user.id);
    else throw new Error("Action not permitted");
  } catch (error) {
    redirect(`${target}?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to update return")}`);
  }
  await deliverReturnNotifications();
  revalidatePath("/buyer/orders");
  revalidatePath(`/seller/orders/${orderId}`);
  revalidatePath(target);
  redirect(`${target}?saved=1`);
}
