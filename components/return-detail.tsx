import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { findOrderById } from "@/lib/store";
import { getReturn, getReturnLabelPayment } from "@/lib/returns";
import { RETURN_POLICY_TEXT, returnRequestError } from "@/lib/return-policy";
import { formatCurrency } from "@/lib/display";
import { updateReturnAction } from "@/app/return-actions";
import { AppShell, PageWrap } from "@/components/ui";

export async function ReturnDetail({ orderId, role, error, saved }: { orderId: string; role: "buyer" | "seller"; error?: string; saved?: string }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const order = await findOrderById(orderId);
  if (!order || (role === "buyer" ? order.buyerId : order.sellerId) !== user.id) notFound();
  const [ret, labelPayment] = await Promise.all([getReturn(orderId), getReturnLabelPayment(orderId)]);
  const now = new Date().getTime();
  const deadline = ret?.received_at ? new Date(ret.received_at.getTime() + 48 * 3600000) : null;
  const canInspect = role === "seller" && ret && deadline && deadline.getTime() > now && !ret.disputed_at && !ret.closed_at;
  const inputClass = "rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm";
  const buttonClass = "w-fit rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white";
  const requestError = returnRequestError(order);
  return <AppShell><PageWrap maxWidth="max-w-4xl"><section className="panel rounded-[2rem] p-6 sm:p-8 space-y-6">
    <Link href={role === "buyer" ? "/buyer/orders" : `/seller/orders/${orderId}`} className="text-sm underline">Back to order</Link>
    <h1 className="text-3xl font-semibold">Return: {order.listingTitle}</h1>
    {error ? <p role="alert" className="rounded-xl bg-rose-100 p-4 text-rose-900">{error}</p> : null}
    {saved ? <p role="status" className="rounded-xl bg-emerald-100 p-4">Return updated.</p> : null}
    <p className="text-sm leading-6 text-stone-700">{order.returnsAccepted ? RETURN_POLICY_TEXT : "This order does not allow standard returns. Contact support about damaged, missing, or misrepresented items."}</p>
    <div className="grid gap-4 sm:grid-cols-3">
      <div><p className="text-sm text-stone-600">Item refund</p><p className="text-xl font-semibold">{formatCurrency((ret?.refund_cents ?? Math.round(order.subtotal * 100)) / 100)}</p></div>
      <div><p className="text-sm text-stone-600">Original shipping (not refunded)</p><p className="text-xl font-semibold">{formatCurrency(order.shippingAmount)}</p></div>
      <div><p className="text-sm text-stone-600">Refund status</p><p className="font-semibold">{ret?.refund_status.replaceAll("_", " ") || "No return requested"}</p></div>
    </div>
    {!ret && role === "buyer" ? requestError ? <p>{requestError}</p> : <form action={updateReturnAction}>
      <input type="hidden" name="orderId" value={orderId}/><input type="hidden" name="action" value="request"/>
      <button className={buttonClass}>Request return</button>
    </form> : null}
    {ret ? <>
      <p>Carrier acceptance deadline: <time>{ret.ship_by.toLocaleString("en-US", { timeZone: "UTC" })} UTC</time></p>
      {ret.refund_status === "succeeded" ? <p className="rounded-xl bg-emerald-100 p-4">Your full item refund has been issued. Your bank may take several days to show the credit.</p> : <p>The refund starts when carrier tracking confirms the package has been accepted. Creating or printing a label does not start the refund.</p>}
      {ret.error && ret.refund_status !== "succeeded" ? <p role="status" className="rounded-xl bg-amber-100 p-4">This return needs support review. You do not need to submit a second return or payment.</p> : null}
      {labelPayment && !["complete", "expired", "quote_expired"].includes(labelPayment.status) ? <p className="rounded-xl bg-stone-100 p-4">Return label: {labelPayment.status === "needs_attention" || labelPayment.status === "purchasing" ? "Payment received; label preparation needs support review. Do not pay again." : labelPayment.status === "quoted" ? "Checkout is ready. Continue below to complete payment." : "Payment received; preparing your label. Refresh shortly."}</p> : null}
      {role === "buyer" && !order.returnLabelUrl && !ret.accepted_at && now < ret.ship_by.getTime() && (!labelPayment || ["quoted", "expired", "quote_expired"].includes(labelPayment.status)) ? <Link className={buttonClass} href={`/buyer/orders/${orderId}/return/shippo`}>Choose and pay for return label</Link> : null}
      {order.returnLabelUrl ? <a href={order.returnLabelUrl} target="_blank" rel="noreferrer" className="block underline">Download return label</a> : null}
      {order.returnQrCodeUrl ? <a href={order.returnQrCodeUrl} target="_blank" rel="noreferrer" className="block underline">Open carrier QR code</a> : null}
      {order.returnTrackingNumber ? <p>Return tracking: {order.returnTrackingNumber}</p> : null}
      {ret.received_at ? <p>Return delivered: {ret.received_at.toLocaleString("en-US", { timeZone: "UTC" })} UTC. Inspection deadline: {deadline!.toLocaleString("en-US", { timeZone: "UTC" })} UTC.</p> : null}
      {ret.disputed_at ? <div className="rounded-xl bg-amber-100 p-4 space-y-2"><p className="font-semibold">{ret.dispute_resolution ? "Dispute reviewed" : "Seller dispute awaiting review"}</p><p className="whitespace-pre-wrap">{ret.dispute_details}</p><p>The completed buyer refund is unchanged. TailorGraph will contact both parties about the outcome.</p></div> : null}
      {ret.closed_at ? <p>Return closed. The seller can review their listing before publishing it again.</p> : null}
      {canInspect ? <div className="space-y-6 border-t border-stone-300 pt-6">
        <h2 className="text-xl font-semibold">Inspect your returned item</h2>
        {ret.refund_status === "succeeded" ? <form action={updateReturnAction}><input type="hidden" name="orderId" value={orderId}/><input type="hidden" name="action" value="accept"/><button className={buttonClass}>Accept return and close</button></form> : null}
        <form action={updateReturnAction} className="grid gap-4">
          <input type="hidden" name="orderId" value={orderId}/><input type="hidden" name="action" value="dispute"/>
          <label className="grid gap-2">What is wrong with the returned item?<textarea name="details" required minLength={20} maxLength={5000} rows={4} className={inputClass} placeholder="Describe damage, missing pieces, a wrong item, or an empty package."/></label>
          <label className="grid gap-2">Photo and packaging evidence links<textarea name="evidence" required maxLength={5000} rows={3} className={inputClass} placeholder="One HTTPS link per line. Include photos from before shipment and after the return."/></label>
          <button className={buttonClass}>Submit return dispute</button>
        </form>
      </div> : null}
    </> : null}
    <Link href="/support" className="block underline">Contact support</Link>
  </section></PageWrap></AppShell>;
}
