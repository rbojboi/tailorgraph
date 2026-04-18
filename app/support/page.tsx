import Link from "next/link";
import { submitSupportRequestAction } from "@/app/actions";
import { AppShell, PageWrap, SectionTitle, Spec } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/display";
import { ensureSeedData, listBuyerOrders, listSellerOrders } from "@/lib/store";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const helpTopics = [
  {
    title: "Account access",
    answer: "Use the password reset flow first if you can’t sign in. If your account email needs correction or verification links are not arriving, send us a support request below."
  },
  {
    title: "Buying and offers",
    answer: "You can buy immediately, make offers where sellers allow them, and review all activity in My Purchases and My Offers. If an accepted price or order looks wrong, use the dispute section."
  },
  {
    title: "Shipping and returns",
    answer: "Tracking and delivery updates live in My Purchases. If a return was accepted but the item came back damaged, incomplete, or not as expected, use the dispute form so we can log the case properly."
  },
  {
    title: "Fit and measurements",
    answer: "Start by saving your measurements in your fit profile. If match quality or tailoring guidance looks off, choose the fit topic below and tell us which listing and measurement set need review."
  }
];

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SupportPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  await ensureSeedData();
  const params = await searchParams;
  const user = await getCurrentUser();
  const [buyerOrders, sellerOrders] = user
    ? await Promise.all([
        listBuyerOrders(user.id),
        listSellerOrders(user.id)
      ])
    : [[], []];
  const recentOrders = [...new Map([...buyerOrders, ...sellerOrders].map((order) => [order.id, order])).values()]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 6);
  const saved = firstValue(params.saved);
  const authError = firstValue(params.authError);

  return (
    <AppShell>
      <PageWrap>
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <p className="eyebrow text-xs text-stone-500">Support</p>
          <h1 className="mt-3 text-4xl font-semibold text-stone-950">Customer support and disputes</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-700">
            Start with the common help topics below. If you still need help, send us a support request. If something involves a return, damaged item, shipping problem, or suspected bad behavior, use the dispute section so it is logged correctly.
          </p>
        </section>

        {saved ? (
          <p className="rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-900">
            {saved === "dispute-received"
              ? "We received your dispute report and logged it for review."
              : "We received your support request and are looking into it."}
          </p>
        ) : null}
        {authError ? (
          <p className="rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">{authError}</p>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <article className="panel rounded-[1.75rem] p-6">
            <SectionTitle
              eyebrow="Common Help"
              title="Start here first"
              description="These are the questions we expect most buyers and sellers to hit first."
            />
            <div className="mt-5 grid gap-4">
              {helpTopics.map((topic) => (
                <article key={topic.title} className="rounded-[1.4rem] border border-stone-300 bg-white p-5">
                  <h2 className="text-base font-semibold text-stone-950">{topic.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-stone-700">{topic.answer}</p>
                </article>
              ))}
            </div>
          </article>

          <article className="panel rounded-[1.75rem] p-6">
            <SectionTitle
              eyebrow="Useful Links"
              title="Fast paths"
              description="These links handle the most common self-service flows."
            />
            <div className="mt-5 grid gap-4">
              <Link href="/forgot-password" className="rounded-[1.4rem] border border-stone-300 bg-white p-5 transition hover:border-stone-950">
                <p className="text-base font-semibold text-stone-950">Reset password</p>
                <p className="mt-2 text-sm leading-6 text-stone-700">Use this if you can’t sign in or need a new password link.</p>
              </Link>
              <Link href="/buyer/orders" className="rounded-[1.4rem] border border-stone-300 bg-white p-5 transition hover:border-stone-950">
                <p className="text-base font-semibold text-stone-950">My Purchases</p>
                <p className="mt-2 text-sm leading-6 text-stone-700">Review tracking, delivery, returns, and purchase status in one place.</p>
              </Link>
              <Link href="/messages" className="rounded-[1.4rem] border border-stone-300 bg-white p-5 transition hover:border-stone-950">
                <p className="text-base font-semibold text-stone-950">Messages</p>
                <p className="mt-2 text-sm leading-6 text-stone-700">Check buyer-seller conversations and confirm any negotiated details there.</p>
              </Link>
            </div>
          </article>
        </section>

        {recentOrders.length ? (
          <section className="panel rounded-[1.75rem] p-6">
            <SectionTitle
              eyebrow="Reference"
              title="Recent order IDs"
              description="If you are reporting a dispute, including the order ID makes it much faster for us to review."
            />
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {recentOrders.map((order) => (
                <article key={order.id} className="rounded-[1.4rem] border border-stone-300 bg-white p-4">
                  <p className="text-sm font-semibold text-stone-950">{order.listingTitle}</p>
                  <p className="mt-1 text-xs text-stone-500">{order.id}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Spec label="Status" value={order.status} />
                    <Spec label="Amount" value={formatCurrency(order.amount)} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-2">
          <article className="panel rounded-[1.75rem] p-6">
            <SectionTitle
              eyebrow="Contact"
              title="General support request"
              description="Use this for account, buying, selling, fit, and general marketplace help."
            />
            <form action={submitSupportRequestAction} className="mt-5 grid gap-4">
              <input type="hidden" name="kind" value="support" />
              {user ? null : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-stone-700">Name</span>
                    <input name="name" className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none" />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-stone-700">Email</span>
                    <input name="email" type="email" className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none" />
                  </label>
                </div>
              )}
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-stone-700">Topic</span>
                <select name="topic" defaultValue="account_access" className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none">
                  <option value="account_access">Account access</option>
                  <option value="buying">Buying</option>
                  <option value="selling">Selling</option>
                  <option value="shipping_returns">Shipping / returns</option>
                  <option value="fit_measurements">Fit / measurements</option>
                  <option value="trust_safety">Trust and safety</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-stone-700">Subject</span>
                <input name="subject" className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none" />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-stone-700">Message</span>
                <textarea
                  name="message"
                  rows={7}
                  className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none"
                  placeholder="Tell us what happened and what you’ve already tried."
                />
              </label>
              <button className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800">
                Submit Support Request
              </button>
            </form>
          </article>

          <article className="panel rounded-[1.75rem] p-6">
            <SectionTitle
              eyebrow="Disputes"
              title="Report an issue or trust and safety concern"
              description="Use this when something requires review, documentation, or intervention."
            />
            <form action={submitSupportRequestAction} className="mt-5 grid gap-4">
              <input type="hidden" name="kind" value="dispute" />
              {user ? null : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-stone-700">Name</span>
                    <input name="name" className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none" />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-stone-700">Email</span>
                    <input name="email" type="email" className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none" />
                  </label>
                </div>
              )}
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-stone-700">Issue type</span>
                <select name="topic" defaultValue="order_dispute" className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none">
                  <option value="order_dispute">Order dispute</option>
                  <option value="damaged_return">Damaged return</option>
                  <option value="shipping_problem">Shipping problem</option>
                  <option value="scam_report">Scam / bad-actor report</option>
                  <option value="trust_safety">Trust and safety concern</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-stone-700">Order ID</span>
                  <input name="orderId" className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none" />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-stone-700">Listing ID</span>
                  <input name="listingId" className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none" />
                </label>
              </div>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-stone-700">Subject</span>
                <input name="subject" className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none" />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-stone-700">What happened?</span>
                <textarea
                  name="message"
                  rows={7}
                  className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none"
                  placeholder="Include dates, what was agreed, what arrived, and what outcome you are seeking."
                />
              </label>
              <button className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-95">
                Submit Dispute Report
              </button>
            </form>
          </article>
        </section>
      </PageWrap>
    </AppShell>
  );
}
