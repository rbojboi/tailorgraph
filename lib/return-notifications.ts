import { getAdminEmails } from "@/lib/admin";
import { getAppUrl } from "@/lib/stripe";
import { findOrderById, findUserById, requirePool } from "@/lib/store";
import { sendReturnEmail } from "@/lib/notifications";

export async function deliverReturnNotifications() {
  const pending = await requirePool().query("SELECT * FROM return_notification_outbox WHERE sent_at IS NULL LIMIT 20");
  for (const row of pending.rows) {
    try {
      const order = await findOrderById(row.order_id);
      if (!order) continue;
      const [buyer, seller] = await Promise.all([findUserById(order.buyerId), findUserById(order.sellerId)]);
      const copy: Record<string, string> = {
        approved: "Return approved. Purchase your return label and hand the package to the carrier within 5 calendar days. Original shipping is not refunded.",
        label_ready: "Your paid return label is ready in Purchases. The full item price will be refunded after the first carrier acceptance scan.",
        refunded: `The full item price ($${order.subtotal.toFixed(2)}) has been refunded. Original shipping and the return-label charge are excluded. Your bank may take several days to show the credit.`,
        received: "The return has been delivered. The seller has 48 hours after carrier delivery to inspect it and report a problem.",
        disputed: "The seller reported a problem with the returned item. TailorGraph will review the evidence. The buyer's completed refund is unchanged.",
        reviewed: "TailorGraph has reviewed the seller's return dispute. Contact support for the decision and any agreed settlement. The buyer is not automatically charged again.",
        needs_attention: "A return payment or label needs attention. Review the return operations page and provider records before retrying."
      };
      const text = copy[row.kind] || "Your return has been updated.";
      const recipients = row.kind === "needs_attention"
        ? getAdminEmails().map(email => ({ email, path: "/admin/returns" }))
        : [buyer ? { email: buyer.email, path: `/buyer/orders/${order.id}/return` } : null,
           seller ? { email: seller.email, path: `/seller/orders/${order.id}/return` } : null,
           ...(row.kind === "disputed" ? getAdminEmails().map(email => ({ email, path: "/admin/returns" })) : [])].filter((value): value is { email: string; path: string } => value !== null);
      if (!recipients.length) throw new Error("No return notification recipients configured");
      for (const recipient of recipients) await sendReturnEmail(recipient.email, `${row.id}:${recipient.email}`, `TailorGraph return: ${order.listingTitle}`, text, `${getAppUrl()}${recipient.path}`);
      await requirePool().query("UPDATE return_notification_outbox SET sent_at=NOW() WHERE id=$1", [row.id]);
    } catch (error) {
      // Leave the durable outbox entry pending. A mail outage cannot undo a refund.
      console.error("Return notification pending", row.id, error instanceof Error ? error.message : "Delivery failed");
    }
  }
}
