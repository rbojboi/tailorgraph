import Link from "next/link";
import { redirect } from "next/navigation";
import { buySelectedShippoRateAction } from "@/app/actions";
import { AppShell, PageWrap, SectionTitle, Spec } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/display";
import { createShippoShipmentQuote, getSellerShipFromAddress, isShippoConfigured } from "@/lib/shippo";
import { ensureSeedData, findListingById, findOrderById } from "@/lib/store";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SellerShippoRatesPage({
  params,
  searchParams
}: {
  params: Promise<{ orderId: string }>;
  searchParams: SearchParams;
}) {
  await ensureSeedData();
  const user = await getCurrentUser();

  if (!user || (user.role !== "seller" && user.role !== "both")) {
    redirect("/?authError=Seller+account+required");
  }

  if (!isShippoConfigured()) {
    redirect("/seller?authError=Add+SHIPPO_API_TOKEN+to+enable+label+buying");
  }

  const { orderId } = await params;
  const query = await searchParams;
  const order = await findOrderById(orderId);

  if (!order || order.sellerId !== user.id) {
    redirect("/seller?authError=Order+not+found");
  }

  const listing = await findListingById(order.listingId);
  if (!listing) {
    redirect("/seller?authError=Listing+not+found");
  }

  const sellerAddress = getSellerShipFromAddress(user);
  if (!sellerAddress) {
    redirect("/account/personal?authError=Add+a+saved+address+before+buying+a+Shippo+label");
  }

  let quote;
  try {
    quote = await createShippoShipmentQuote({
      order,
      listing,
      seller: user
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shippo could not return rates for this order.";
    redirect(`/seller?authError=${encodeURIComponent(message)}`);
  }

  const saved = firstValue(query.saved);

  return (
    <AppShell>
      <PageWrap maxWidth="max-w-5xl">
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <SectionTitle
                eyebrow="Shipping"
                title="Choose a Shippo Rate"
                description="Compare the returned services for this order and buy the label you want."
              />
            </div>
            <Link href="/seller/listings?filter=sold" className="shrink-0 self-start rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900">
              Back to Seller
            </Link>
          </div>

          {saved ? <p className="mt-4 rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-900">Saved {saved}.</p> : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Spec label="Order" value={order.listingTitle} />
            <Spec label="Buyer" value={order.buyerName} />
            <Spec label="Ship From" value={`${sellerAddress.city}, ${sellerAddress.state}`} />
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

                <form action={buySelectedShippoRateAction} className="mt-4 grid gap-3 sm:grid-cols-3">
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="shipmentId" value={quote.shipmentId} />
                  <input type="hidden" name="rateId" value={rate.rateId} />
                  <input type="hidden" name="provider" value={rate.provider} />
                  <input type="hidden" name="serviceLevel" value={rate.serviceLevel} />
                  <input type="hidden" name="currency" value={rate.currency || ""} />
                  <input type="hidden" name="rateAmount" value={rate.amount ?? ""} />
                  <label className="sm:col-span-2 flex flex-col gap-2">
                    <span className="text-sm font-medium text-stone-700">Seller notes</span>
                    <input
                      name="sellerNotes"
                      type="text"
                      defaultValue={order.sellerNotes || ""}
                      className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none"
                    />
                  </label>
                  <div className="flex items-end">
                    <button className="w-full rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white">
                      Buy This Label
                    </button>
                  </div>
                </form>
              </article>
            ))}
          </div>
        </section>
      </PageWrap>
    </AppShell>
  );
}
