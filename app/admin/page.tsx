import Link from "next/link";
import { redirect } from "next/navigation";
import { sendSenderEmailTestsAction } from "@/app/actions";
import { AppShell, PageWrap, SectionTitle, Spec } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { ensureSeedData, listAllOrders, listMarketplace, listUsers } from "@/lib/store";
import type { Listing, Order, User } from "@/lib/types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  await ensureSeedData();
  const user = await getCurrentUser();
  const params = await searchParams;
  const emailTestSent = firstValue(params.emailTestSent);
  const emailTestError = firstValue(params.emailTestError);

  if (!isAdminUser(user)) {
    redirect("/?authError=Admin+access+required");
  }

  const users = await listUsers();
  const orders = await listAllOrders();
  const listings = await listMarketplace();
  const activeListings = listings.filter((listing: Listing) => listing.status === "active").length;
  const soldListings = listings.filter((listing: Listing) => listing.status === "sold").length;
  const paidOrders = orders.filter((order: Order) => order.status === "paid").length;

  return (
    <AppShell>
      <PageWrap>
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow text-xs text-stone-500">Admin Dashboard</p>
              <h1 className="mt-3 text-4xl font-semibold text-stone-950">Platform operations</h1>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-4">
          <article className="panel rounded-[1.75rem] p-6"><Spec label="Users" value={String(users.length)} /></article>
          <article className="panel rounded-[1.75rem] p-6"><Spec label="Listings" value={String(listings.length)} /></article>
          <article className="panel rounded-[1.75rem] p-6"><Spec label="Active listings" value={String(activeListings)} /></article>
          <article className="panel rounded-[1.75rem] p-6"><Spec label="Paid orders" value={String(paidOrders)} /></article>
        </section>

        <section className="panel rounded-[1.75rem] p-6">
          <SectionTitle
            eyebrow="Email"
            title="Sender identity tests"
            description="Send one test email from each TailorGraph sender category to a saved account email. This uses the live Resend configuration."
          />
          {emailTestSent ? (
            <p className="mt-4 rounded-[1.25rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {emailTestSent}
            </p>
          ) : null}
          {emailTestError ? (
            <p className="mt-4 rounded-[1.25rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {emailTestError}
            </p>
          ) : null}
          <form action={sendSenderEmailTestsAction} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1">
              <span className="text-sm font-medium text-stone-700">Username</span>
              <input
                name="username"
                type="text"
                defaultValue="bobbyveebee"
                className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none"
              />
            </label>
            <button
              type="submit"
              className="rounded-full border border-stone-900 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-stone-950 hover:text-white"
            >
              Send Sender Tests
            </button>
          </form>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <article className="panel rounded-[1.75rem] p-6">
            <SectionTitle
              eyebrow="Users"
              title="Recent accounts"
              description="Quick visibility into roles and seller payout readiness."
            />
            <div className="mt-5 grid gap-4">
              {users.map((account: User) => (
                <article key={account.id} className="rounded-[1.5rem] border border-stone-300 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-stone-950">{account.name}</h2>
                      <p className="mt-1 text-sm text-stone-700">{account.email}</p>
                    </div>
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-800">{account.role}</span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Spec label="Stripe account" value={account.stripeAccountId || "Not connected"} />
                    <Spec label="Onboarding complete" value={account.stripeOnboardingComplete ? "Yes" : "No"} />
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="panel rounded-[1.75rem] p-6">
            <SectionTitle
              eyebrow="Orders"
              title="Recent transactions"
              description="Monitor completed and pending order flow across the marketplace."
            />
            <div className="mt-5 grid gap-4">
              {orders.map((order: Order) => (
                <article key={order.id} className="rounded-[1.5rem] border border-stone-300 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-stone-950">{order.listingTitle}</h2>
                      <p className="mt-1 text-sm text-stone-700">{order.buyerName} to {order.sellerName}</p>
                    </div>
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-800">{order.status}</span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <Spec label="Amount" value={`$${order.amount}`} />
                    <Spec label="Payment" value={order.paymentMethod} />
                    <Spec label="Created" value={new Date(order.createdAt).toLocaleDateString("en-US")} />
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-6 rounded-[1.5rem] bg-white p-4">
              <p className="text-sm font-semibold text-stone-950">Listing state</p>
              <p className="mt-2 text-sm text-stone-700">Active: {activeListings} | Sold: {soldListings}</p>
            </div>
          </article>
        </section>
      </PageWrap>
    </AppShell>
  );
}
