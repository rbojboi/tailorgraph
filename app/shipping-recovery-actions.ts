"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { recoverOutboundLabel } from "@/lib/outbound-labels";

export async function recoverOutboundLabelAction(form: FormData) {
  if (!isAdminUser(await getCurrentUser())) redirect('/login?authError=Admin+access+required');
  try { await recoverOutboundLabel(String(form.get('orderId') || ''), String(form.get('transactionId') || '')); }
  catch (error) { redirect('/admin/payments?error=' + encodeURIComponent(error instanceof Error ? error.message : 'Recovery failed')); }
  revalidatePath('/admin/payments');
  revalidatePath('/seller');
  redirect('/admin/payments?saved=label-recovered');
}
