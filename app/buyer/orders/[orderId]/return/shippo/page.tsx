import Link from "next/link";
import { redirect } from "next/navigation";
import { buySelectedShippoReturnRateAction } from "@/app/actions";
import { AppShell, PageWrap, SectionTitle, Spec } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/display";
import { createShippoReturnShipmentQuote, isShippoConfigured } from "@/lib/shippo";
import { ensureSeedData, findListingById, findOrderById, findUserById } from "@/lib/store";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BuyerReturnShippoRatesPage({
  params,
  searchParams
}: {
  params: Promise<{ orderId: string }>;
  searchParams: SearchParams;
}) {
  await ensureSeedData();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/?authError=Please+log+in");
  }

  if (!isShippoConfigured()) {
    redirect("/buyer/orders?authError=Add+SHIPPO_API_TOKEN+to+enable+return+labels");
  }

  const [{ orderId }, query] = await Promise.all([params, searchParams]);
  const order = await findOrderById(orderId);

  if (!order || order.buyerId !== user.id) {
    redirect("/buyer/orders?authError=Order+not+found");
  }

  if (!order.returnsAccepted) {
    redirect("/buyer/orders?authError=This+order+was+not+marked+return-eligible");
  }

  if (order.returnStatus !== "approved" && order.returnStatus !== "label_created") {
    redirect("/buyer/orders?authError=The+seller+needs+to+confirm+this+return+before+you+can+create+a+label");
  }

  if (order.returnLabelUrl || order.returnQrCodeUrl) {
    redirect("/buyer/orders?saved=return-label");
  }

  const [listing, seller] = await Promise.all([findListingById(order.listingId), findUserById(order.sellerId)]);

  if (!listing) {
    redirect("/buyer/orders?authError=Listing+not+found+for+this+order");
  }

  if (!seller) {
    redirect("/buyer/orders?authError=Seller+account+not+found+for+this+order");
  }

  let quote;
  try {
    quote = await createShippoReturnShipmentQuote({
      order,
      listing,
      buyer: user,
      seller
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shippo could not return rates for this return.";
    redirect(`/buyer/orders?authError=${encodeURIComponent(message)}`);
  }

  const authError = firstValue(query.authError);

  return (
    <AppShell>
      <PageWrap maxWidth="max-w-5xl">
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <SectionTitle
                eyebrow="Return Shipping"
                title="Choose a Return Label"
                description="Compare available return services and choose the one you want to use."
              />
            </div>
            <Link
              href="/buyer/orders"
              className="shrink-0 self-start rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 transition hover:border-stone-950"
            >
              Back to Purchases
            </Link>
          </div>

          {authError ? (
            <p className="mt-4 rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">{authError}</p>
          ) : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Spec label="Order" value={order.listingTitle} />
            <Spec label="Returning From" value={`${order.shippingAddress.city}, ${order.shippingAddress.state}`} />
            <Spec label="Returning To" value={seller.name} />
          </div>

          <div className="mt-6 rounded-2xl bg-amber-100 px-4 py-3 text-sm leading-6 text-amber-950">
            If a carrier is not enabled in Shippo, choose another option for now. USPS is usually the safest test path
            while UPS activation is still pending.
          </div>

          <div className="mt-6 grid gap-4">
            {quote.rates.map((rate) => (
              <article key={rate.rateId} className="rounded-[1.5rem] border border-stone-300 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-stone-950">
                      {rate.provider} {rate.serviceLevel ? `- ${rate.serviceLevel}` : ""}
                    </h2>
                    <p className="mt-2 text-sm text-stone-700">
                      {rate.estimatedDays ? `${rate.estimatedDays} day estimate` : rate.durationTerms || "Transit estimate unavailable"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-stone-950">
                      {rate.amount !== null ? formatCurrency(rate.amount) : "Unavailable"}
                    </p>
                    <p className="mt-1 text-sm text-stone-600">{rate.currency || "USD"}</p>
                  </div>
                </div>

                <form action={buySelectedShippoReturnRateAction} className="mt-4 flex justify-end">
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="shipmentId" value={quote.shipmentId} />
                  <input type="hidden" name="rateId" value={rate.rateId} />
                  <input type="hidden" name="provider" value={rate.provider} />
                  <input type="hidden" name="serviceLevel" value={rate.serviceLevel} />
                  <input type="hidden" name="currency" value={rate.currency || ""} />
                  <input type="hidden" name="rateAmount" value={rate.amount ?? ""} />
                  <input type="hidden" name="returnTo" value={`/buyer/orders/${order.id}/return/shippo`} />
                  <button className="rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white">
                    Buy This Return Label
                  </button>
                </form>
              </article>
            ))}
          </div>
        </section>
      </PageWrap>
    </AppShell>
  );
}
