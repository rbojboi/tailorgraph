import Link from "next/link";
import { redirect } from "next/navigation";
import { BuyerSubpageHeader } from "@/components/buyer-subpage-header";
import { OrderDisputeForm } from "@/components/order-dispute-form";
import { AppShell, PageWrap, Spec } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency, formatDisplayValue } from "@/lib/display";
import { ensureSeedData, findOrderById } from "@/lib/store";

type PageParams = Promise<{ orderId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BuyerOrderDisputePage({
  params,
  searchParams
}: {
  params: PageParams;
  searchParams: SearchParams;
}) {
  await ensureSeedData();
  const user = await getCurrentUser();

  if (!user || (user.role !== "buyer" && user.role !== "both")) {
    redirect("/login?authError=Please+log+in+to+open+a+dispute");
  }

  const [{ orderId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const order = await findOrderById(orderId);

  if (!order || order.buyerId !== user.id) {
    redirect("/buyer/orders?authError=Order+not+found");
  }

  const saved = firstValue(resolvedSearchParams.saved);
  const authError = firstValue(resolvedSearchParams.authError);

  return (
    <AppShell>
      <PageWrap maxWidth="max-w-5xl">
        <BuyerSubpageHeader
          eyebrow="Buyer Dashboard"
          title="Open a Dispute"
          actionHref="/buyer/orders"
          actionLabel="Back to My Purchases"
        />

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
              Sold by{" "}
              <Link href={`/users/${order.sellerName}`} className="font-semibold transition hover:text-[var(--accent)]">
                @{order.sellerName}
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
              role="buyer"
              returnTo={`/buyer/orders/${order.id}/dispute?saved=issue`}
              expanded
            />
          </article>
        </section>
      </PageWrap>
    </AppShell>
  );
}
