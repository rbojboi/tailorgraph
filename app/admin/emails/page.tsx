import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { requirePool } from "@/lib/store";
import { AppShell, PageWrap, SectionTitle } from "@/components/ui";
import { retryEmailAction, refreshEmailStatusAction } from "./actions";

export default async function EmailAdminPage({searchParams}:{searchParams:Promise<{status?:string;notice?:string}>}) {
  if (!isAdminUser(await getCurrentUser())) redirect("/login?authError=Admin+access+required");
  const {status="all",notice}=await searchParams;
  const db=requirePool();
  const [log,counts,health]=await Promise.all([
    db.query(`SELECT l.*,e.status AS queue_status,e.attempts,e.last_error AS queue_error FROM email_delivery_log l
      LEFT JOIN email_outbox e ON e.event_key=l.event_key WHERE $1='all' OR l.status=$1 ORDER BY l.created_at DESC LIMIT 100`,[status]),
    db.query("SELECT status,count(*)::int AS count FROM email_delivery_log GROUP BY status"),
    db.query("SELECT last_success_at FROM email_worker_health WHERE id=1")
  ]);
  return <AppShell><PageWrap><section className="panel rounded-3xl p-6">
    <SectionTitle eyebrow="Admin" title="Email delivery" description="Review delivery status and safely retry unacknowledged failures. Accepted means the provider has the email; delivered means the recipient’s mail server accepted it." />
    <Link className="mt-4 block underline" href="/admin">Back to admin</Link>
    <p className="mt-4 text-sm">Last worker success: {health.rows[0]?.last_success_at?.toISOString() ?? "No successful run recorded"}</p>
    <p className="mt-2 text-sm">{counts.rows.map(row=>`${row.status}: ${row.count}`).join(" · ") || "No emails recorded yet."}</p>
    {notice && <p role="status" className="my-4 rounded-xl bg-stone-100 p-4">{notice==="queued" ? "Retry queued with the original duplicate-protection key." : notice==="refreshed" ? "Recent provider statuses refreshed." : "This email cannot be safely retried automatically. Review its provider record before taking action."}</p>}
    <div className="my-6 flex flex-wrap gap-4"><form><label>Status <select name="status" defaultValue={status} className="rounded border p-2">
      {["all","queued","digest_pending","digested","retrying","sent","delivered","delivery_delayed","failed","skipped","bounced","complained","suppressed"].map(value=><option key={value}>{value}</option>)}
    </select></label><button className="ml-2 rounded border p-2">Filter</button></form>
    <form action={refreshEmailStatusAction}><button className="rounded border p-2">Refresh provider status</button></form></div>
    <div className="grid gap-4">{log.rows.map(row=><article key={row.event_key} className="rounded-2xl border border-stone-300 p-4">
      <h2 className="font-semibold">{row.subject}</h2><p className="break-all text-sm">{row.recipient} · {row.category}</p>
      <p className="mt-2 text-sm">{row.status} · {row.created_at.toISOString()} · {row.attempts ?? 0} queue attempts</p>
      {row.provider_id && <p className="break-all text-xs">Provider ID: {row.provider_id}</p>}
      {(row.last_error || row.queue_error) && <p className="text-sm text-red-800">{row.last_error || row.queue_error}</p>}
      {row.queue_status==="failed" && !row.provider_id && <form action={retryEmailAction} className="mt-3"><input type="hidden" name="eventKey" value={row.event_key}/><button className="rounded bg-stone-950 px-4 py-2 text-sm text-white">Retry if safe</button></form>}
    </article>)}</div><p className="mt-4 text-sm">Showing the most recent 100 matching emails. Status polling covers the last seven days; signed webhooks can also report later events.</p>
  </section></PageWrap></AppShell>;
}
