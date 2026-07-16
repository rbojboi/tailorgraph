import Link from "next/link";
import { redirect } from "next/navigation";
import { OrderDisputeForm } from "@/components/order-dispute-form";
import { AppShell, PageWrap, SectionTitle, Spec } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency, formatDisplayValue } from "@/lib/display";
import { ensureSeedData, findOrderById } from "@/lib/store";

type PageParams = Promise<{ orderId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SellerOrderDisputePage({
  params,
  searchParams
}: {
  params: PageParams;
  searchParams: SearchParams;
}) {
  await ensureSeedData();
  const user = await getCurrentUser();

  if (!user || (user.role !== "seller" && user.role !== "both")) {
    redirect("/?authError=Seller+account+required");
  }

  const [{ orderId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const order = await findOrderById(orderId);

  if (!order || order.sellerId !== user.id) {
    redirect("/seller?authError=Order+not+found");
  }

  const saved = firstValue(resolvedSearchParams.saved);
  const authError = firstValue(resolvedSearchParams.authError);

  return (
    <AppShell>
      <PageWrap maxWidth="max-w-5xl">
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <SectionTitle
              eyebrow="Seller Dashboard"
              title="Report an Order Dispute"
              description="Use this when an order, shipment, return, or buyer conduct issue needs TailorGraph review."
            />
            <Link
              href={`/seller/orders/${order.id}`}
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 transition hover:border-stone-950"
            >
              Back to Order
            </Link>
          </div>
        </section>

        {saved === "issue" ? (
          <p className="rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-900">
            We received your dispute and logged it for TailorGraph review.
          </p>
        ) : null}
        {authError ? (
          <p className="rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">
            {decodeURIComponent(authError.replace(/\+/g, " "))}
          </p>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <article className="panel rounded-[1.75rem] p-6">
            <p className="text-sm font-semibold text-stone-950">{order.listingTitle}</p>
            <p className="mt-2 text-sm text-stone-700">
              Buyer:{" "}
              <Link
                href={`/users/${order.buyerUsername || order.buyerName}`}
                className="font-semibold transition hover:text-[var(--accent)]"
              >
                @{order.buyerUsername || order.buyerName}
              </Link>
            </p>
            <div className="mt-5 grid gap-3">
              <Spec label="Order total" value={formatCurrency(order.amount)} />
              <Spec label="Status" value={formatDisplayValue(order.status)} />
              <Spec label="Order ID" value={order.id} />
            </div>
          </article>

          <article className="panel rounded-[1.75rem] p-6">
            <OrderDisputeForm
              orderId={order.id}
              role="seller"
              returnTo={`/seller/orders/${order.id}/dispute?saved=issue`}
              expanded
            />
          </article>
        </section>
      </PageWrap>
    </AppShell>
  );
}
