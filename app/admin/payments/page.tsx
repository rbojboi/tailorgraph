import Link from "next/link";
import {redirect} from "next/navigation";
import {getCurrentUser} from "@/lib/auth";
import {isAdminUser} from "@/lib/admin";
import {requirePool} from "@/lib/store";
import {AppShell,PageWrap,SectionTitle} from "@/components/ui";
import {recoverOutboundLabelAction} from "@/app/shipping-recovery-actions";

export default async function PaymentAdminPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  if(!isAdminUser(await getCurrentUser())) redirect("/login?authError=Admin+access+required");
  const query=await searchParams;
  const [labels,refunds,rows,legacy]=await Promise.all([
  requirePool().query("SELECT * FROM outbound_labels WHERE state<>'complete' ORDER BY created_at LIMIT 100"),
  requirePool().query("SELECT * FROM payment_refund_reviews ORDER BY updated_at DESC LIMIT 100"),
  requirePool().query(`SELECT id,offer_id,state,error_code,session_id,payment_intent_id,order_ids,created_at,updated_at,expires_at,
    provider_params->>'totalCents' AS total FROM commerce_payments ORDER BY created_at DESC LIMIT 100`),
  requirePool().query(`SELECT id,listing_id FROM orders o WHERE status='pending_payment' AND stripe_checkout_session_id IS NULL
    AND NOT EXISTS(SELECT 1 FROM commerce_payments p WHERE o.id=ANY(p.order_ids)) LIMIT 100`)]);
  return <AppShell><PageWrap><section className="panel rounded-3xl p-6">
    <SectionTitle eyebrow="Admin" title="Payment processing" description="Review pending payments and inventory reservations. Verify Stripe before resolving a payment that needs support review."/>
    <Link className="my-4 block underline" href="/admin">Back to admin</Link>
    {query.error&&<p role="alert" className="my-4 text-red-800">{query.error}</p>}
    {query.saved&&<p role="status" className="my-4">Label recovered.</p>}
    <h2 className="my-4 font-semibold">Labels requiring recovery</h2>
    {labels.rows.map(row=><article key={row.order_id} className="my-4 rounded-2xl border p-4">
      <p>Order: {row.order_id} · {row.state}</p><p>{row.error}</p>
      <p className="my-2 text-sm">Find the existing transaction in Shippo with metadata outbound-label:{row.order_id}. Recovery verifies ownership and never purchases another label.</p>
      <form action={recoverOutboundLabelAction} className="flex flex-wrap gap-2">
        <input type="hidden" name="orderId" value={row.order_id}/>
        <label>Shippo transaction ID <input name="transactionId" required={!row.label} className="rounded border p-2"/></label>
        <button className="rounded bg-stone-900 px-4 py-2 text-white">Recover label</button>
      </form>
    </article>)}
    <h2 className="my-4 font-semibold">Stripe refund reviews</h2>
    <p className="text-sm">Check seller transfer recovery and the physical item before resolving these cases. Inventory stays unavailable; partial or failed external refunds hold fulfillment.</p>
    {refunds.rows.map(row=><article key={row.payment_intent_id} className="my-4 rounded-2xl border p-4">
      <p className="break-all">{row.payment_intent_id} · {row.state}</p>
      <p>Refunded: {(row.amount_refunded/100).toFixed(2)} · Charge: {row.charge_id}</p><p className="break-all text-sm">{row.details}</p>
    </article>)}
    <div className="grid gap-4">{rows.rows.map(row=><article key={row.id} className="rounded-2xl border p-4">
      <h2 className="font-semibold">${(Number(row.total)/100).toFixed(2)} USD · {row.state}</h2>
      <p className="break-all text-sm">Payment: {row.id} · Orders: {row.order_ids.join(", ")}</p>
      <p className="text-sm">Updated: {row.updated_at.toISOString()} · Reservation deadline: {row.expires_at.toISOString()}</p>
      {row.error_code&&<p className="text-sm text-red-800">{row.error_code}</p>}
      {row.payment_intent_id&&<p className="break-all text-sm">Stripe payment: {row.payment_intent_id}</p>}
      {row.session_id&&<p className="break-all text-sm">Stripe checkout: {row.session_id}</p>}
    </article>)}</div>
    {legacy.rows.length>0&&<aside className="mt-6 rounded-2xl bg-amber-50 p-4"><h2 className="font-semibold">Legacy checkouts requiring review</h2>
      <p className="text-sm">These orders have no recorded Stripe session. Check Stripe before changing their status or releasing inventory.</p>
      {legacy.rows.map(row=><p className="break-all text-sm" key={row.id}>Order: {row.id} · Listing: {row.listing_id}</p>)}
    </aside>}
  </section></PageWrap></AppShell>;
}
