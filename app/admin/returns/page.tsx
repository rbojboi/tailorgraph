import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { requirePool } from "@/lib/store";
import { updateReturnAction } from "@/app/return-actions";
import { AppShell, PageWrap } from "@/components/ui";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  if (!isAdminUser(await getCurrentUser())) redirect("/login");
  const query = await searchParams;
  const rows = (await requirePool().query(`SELECT r.*,o.listing_title,p.status AS label_status,p.error AS label_error
    FROM order_returns r JOIN orders o ON o.id=r.order_id
    LEFT JOIN LATERAL (SELECT * FROM return_label_payments WHERE order_id=r.order_id ORDER BY created_at DESC LIMIT 1) p ON TRUE
    ORDER BY r.updated_at DESC LIMIT 100`)).rows;
  return <AppShell><PageWrap><section className="panel rounded-[2rem] p-6 space-y-6">
    <Link href="/admin" className="underline">Admin dashboard</Link><h1 className="text-3xl font-semibold">Return operations</h1>
    {query.error ? <p role="alert" className="bg-rose-100 p-4 rounded-xl">{query.error}</p> : null}
    {query.saved ? <p role="status">Return updated.</p> : null}
    {!rows.length ? <p>No returns yet.</p> : null}
    {rows.map(row => <article key={row.order_id} className="rounded-2xl border border-stone-300 p-5 space-y-3">
      <h2 className="text-xl font-semibold">{row.listing_title}</h2><p className="break-all text-sm">Order {row.order_id}</p>
      <p>Refund: {row.refund_status} · Seller recovery: {row.recovery_status} · Label: {row.label_status || "not purchased"}</p>
      <p className="break-all text-sm">Stripe refund: {row.stripe_refund_id || "—"} · Reversal: {row.stripe_reversal_id || "—"}</p>
      {row.error || row.label_error ? <p className="text-rose-900">{row.error || row.label_error}</p> : null}
      <form action={updateReturnAction}><input type="hidden" name="orderId" value={row.order_id}/><input type="hidden" name="action" value="retry"/><button className="rounded-full border px-4 py-2">Reconcile tracking and refund</button></form>
      {["purchasing", "needs_attention"].includes(row.label_status) ? <form action={updateReturnAction} className="grid gap-2">
        <input type="hidden" name="orderId" value={row.order_id}/><input type="hidden" name="action" value="recover_label"/>
        <label>Successful Shippo transaction ID<input className="block w-full border rounded-xl p-3" name="transactionId" required/></label>
        <p className="text-sm">Match the transaction to this paid label in Shippo. Recovery checks its metadata. An uncertain purchase must not be submitted again.</p>
        <button className="w-fit rounded-full border px-4 py-2">Recover purchased label</button>
      </form> : null}
      {row.disputed_at ? <div className="space-y-3"><h3 className="font-semibold">Seller dispute</h3><p className="whitespace-pre-wrap">{row.dispute_details}</p><p className="whitespace-pre-wrap break-all">{row.dispute_evidence}</p>
        {row.dispute_resolution ? <p>{row.dispute_resolution}</p> : <form action={updateReturnAction} className="grid gap-3">
          <input type="hidden" name="orderId" value={row.order_id}/><input type="hidden" name="action" value="review"/>
          <label>Decision<select name="outcome" className="block border rounded-xl p-3"><option value="declined">Decline seller dispute</option><option value="upheld">Uphold seller dispute</option></select></label>
          <label>Review findings and any separately arranged reimbursement<textarea name="notes" required minLength={20} maxLength={5000} className="block w-full border rounded-xl p-3"/></label>
          <p className="text-sm">Recording a decision does not recharge the buyer or transfer reimbursement. Record any separately authorized settlement here.</p>
          <button className="w-fit rounded-full bg-stone-950 text-white px-4 py-2">Record decision and close</button>
        </form>}
      </div> : null}
    </article>)}
  </section></PageWrap></AppShell>;
}
