import Link from "next/link";
import {redirect} from "next/navigation";
import {getCurrentUser} from "@/lib/auth";
import {isAdminUser} from "@/lib/admin";
import {requirePool} from "@/lib/store";
import {AppShell,PageWrap,SectionTitle} from "@/components/ui";

export default async function PaymentAdminPage() {
  if(!isAdminUser(await getCurrentUser())) redirect("/login?authError=Admin+access+required");
  const rows=await requirePool().query(`SELECT id,offer_id,state,error_code,session_id,payment_intent_id,order_ids,created_at,updated_at,expires_at,
    provider_params->>'totalCents' AS total FROM commerce_payments ORDER BY created_at DESC LIMIT 100`);
  const legacy=await requirePool().query(`SELECT id,listing_id FROM orders o WHERE status='pending_payment' AND stripe_checkout_session_id IS NULL
    AND NOT EXISTS(SELECT 1 FROM commerce_payments p WHERE o.id=ANY(p.order_ids)) LIMIT 100`);
  return <AppShell><PageWrap><section className="panel rounded-3xl p-6">
    <SectionTitle eyebrow="Admin" title="Payment processing" description="Review pending payments and inventory reservations. Verify Stripe before resolving a payment that needs support review."/>
    <Link className="my-4 block underline" href="/admin">Back to admin</Link>
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
