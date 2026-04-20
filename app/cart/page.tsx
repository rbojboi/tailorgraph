import Link from "next/link";
import { removeFromCartAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { getCartIds } from "@/lib/cart";
import { formatCurrency, formatDisplayValue, formatSizeLabel } from "@/lib/display";
import { isStripeConfigured } from "@/lib/stripe";
import { ensureSeedData, listMarketplace } from "@/lib/store";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function addBusinessDays(startDate: Date, businessDays: number) {
  const date = new Date(startDate);
  let remaining = businessDays;

  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();

    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }

  return date;
}

function formatEstimatedArrivalRange(startBusinessDays: number, endBusinessDays: number) {
  const now = new Date();
  const start = addBusinessDays(now, startBusinessDays);
  const end = addBusinessDays(now, endBusinessDays);
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

export default async function CartPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  await ensureSeedData();
  const user = await getCurrentUser();
  const cartIds = await getCartIds();
  const marketplace = await listMarketplace();
  const cartListings = marketplace.filter((listing) => cartIds.includes(listing.id) && listing.status === "active");
  const subtotal = cartListings.reduce((sum, listing) => sum + listing.price, 0);
  const shippingTotal = cartListings.reduce((sum, listing) => sum + listing.shippingPrice, 0);
  const total = subtotal + shippingTotal;
  const stripeEnabled = isStripeConfigured();

  const sellerGroups = Array.from(
    cartListings.reduce(
      (groups, listing) => {
        const current = groups.get(listing.sellerId);

        if (current) {
          current.items.push(listing);
          current.subtotal += listing.price;
          current.shippingTotal += listing.shippingPrice;
          current.total += listing.price + listing.shippingPrice;
          return groups;
        }

        groups.set(listing.sellerId, {
          sellerId: listing.sellerId,
          sellerDisplayName: listing.sellerDisplayName,
          items: [listing],
          subtotal: listing.price,
          shippingTotal: listing.shippingPrice,
          total: listing.price + listing.shippingPrice
        });

        return groups;
      },
      new Map<
        string,
        {
          sellerId: string;
          sellerDisplayName: string;
          items: typeof cartListings;
          subtotal: number;
          shippingTotal: number;
          total: number;
        }
      >()
    ).values()
  );

  return (
    <main className="grain px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="panel rounded-[2rem] p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow text-xs text-stone-500">Cart</p>
              <h1 className="mt-3 text-4xl font-semibold text-stone-950">Checkout and ordering</h1>
              <p className="mt-3 text-sm text-stone-700">
                {stripeEnabled
                  ? "Your cart can hold multiple sellers. Checkout still happens seller by seller so payouts and shipping stay clean."
                  : "Checkout is unavailable until Stripe payments are configured."}
              </p>
            </div>
            <Link
              href="/"
              className="shrink-0 self-start rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800"
            >
              Back to Marketplace
            </Link>
          </div>

          {firstValue(params.checkoutError) ? (
            <p className="mt-4 rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">
              {firstValue(params.checkoutError)}
            </p>
          ) : null}
          {firstValue(params.ordered) ? (
            <p className="mt-4 rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-900">
              Order placed successfully.
            </p>
          ) : null}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_21rem]">
          <div className="grid gap-6">
            {sellerGroups.length ? (
              sellerGroups.map((group) => (
                <section key={group.sellerId} className="panel rounded-[1.75rem] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="eyebrow text-xs text-stone-500">Seller Group</p>
                      <h2 className="mt-2 text-2xl font-semibold text-stone-950">@{group.sellerDisplayName}</h2>
                      <p className="mt-2 text-sm text-stone-700">
                        {group.items.length} item{group.items.length === 1 ? "" : "s"} ready to check out together from this seller.
                      </p>
                    </div>
                    <div className="rounded-[1.25rem] border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700">
                      <p>Subtotal: {formatCurrency(group.subtotal)}</p>
                      <p className="mt-1">Shipping: {formatCurrency(group.shippingTotal)}</p>
                      <p className="mt-2 text-base font-semibold text-stone-950">Total: {formatCurrency(group.total)}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4">
                    {group.items.map((listing) => {
                      const estimatedArrival = formatEstimatedArrivalRange(3, 7);

                      return (
                        <article
                          key={listing.id}
                          className="rounded-[1.5rem] border border-stone-300 bg-[rgba(120,113,108,0.08)] p-4"
                        >
                          <div className="flex gap-4">
                            <div className="h-32 w-28 shrink-0 overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
                              <Link href={`/listings/${listing.id}`} className="block h-full w-full">
                                {listing.media[0] ? (
                                  listing.media[0].kind === "video" ? (
                                    <video src={listing.media[0].url} className="h-full w-full object-cover" />
                                  ) : (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={listing.media[0].url} alt={listing.title} className="h-full w-full object-cover" />
                                  )
                                ) : (
                                  <div className="flex h-full items-center justify-center px-2 text-center text-xs text-stone-500">
                                    Media
                                  </div>
                                )}
                              </Link>
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-stone-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-50">
                                      {formatDisplayValue(listing.category)}
                                    </span>
                                    <span className="rounded-full bg-[rgba(186,108,59,0.12)] px-3 py-1 text-[11px] font-medium tracking-[0.16em] text-[var(--accent)]">
                                      {formatSizeLabel(listing.sizeLabel) || "None"}
                                    </span>
                                  </div>
                                  <Link
                                    href={`/listings/${listing.id}`}
                                    className="mt-3 block text-xl font-semibold text-stone-950 transition hover:text-[var(--accent)]"
                                  >
                                    {listing.title}
                                  </Link>
                                  <p className="mt-1 text-sm text-stone-700">{listing.brand}</p>
                                  <p className="mt-1 text-sm text-stone-600">
                                    <Link href={`/users/${listing.sellerDisplayName}`} className="transition hover:text-stone-950">
                                      @{listing.sellerDisplayName}
                                    </Link>
                                  </p>
                                </div>

                                <form action={removeFromCartAction} className="shrink-0">
                                  <input type="hidden" name="listingId" value={listing.id} />
                                  <button className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800">
                                    Remove
                                  </button>
                                </form>
                              </div>

                              <div className="mt-4 rounded-[1.25rem] border border-stone-200 bg-white px-4 py-4">
                                <div className="grid gap-x-6 gap-y-2 text-sm text-stone-700 sm:grid-cols-2">
                                  <span>Item Price: {formatCurrency(listing.price)}</span>
                                  <span>Shipping: {formatCurrency(listing.shippingPrice)}</span>
                                  <span>Estimated Arrival: {estimatedArrival}</span>
                                  <span>Accepts Returns: {listing.returnsAccepted ? "Yes" : "No"}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <div className="mt-5 flex justify-end">
                    <Link
                      href={`/checkout?sellerId=${encodeURIComponent(group.sellerId)}`}
                      className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white"
                    >
                      Check Out @{group.sellerDisplayName}
                    </Link>
                  </div>
                </section>
              ))
            ) : (
              <article className="panel rounded-[1.75rem] p-8 text-center text-stone-700">
                Your cart is empty.
              </article>
            )}
          </div>

          <aside className="panel h-fit self-start rounded-[1.75rem] p-6">
            <p className="eyebrow text-xs text-stone-500">Cart summary</p>
            <h2 className="mt-3 text-2xl font-semibold text-stone-950">Everything in your cart</h2>
            <p className="mt-5 text-4xl font-semibold text-stone-950">{formatCurrency(total)}</p>
            <div className="mt-4 rounded-[1.5rem] bg-white p-4 text-sm text-stone-700">
              <p>Items: {cartListings.length}</p>
              <p className="mt-1">Subtotal: {formatCurrency(subtotal)}</p>
              <p className="mt-1">Shipping: {formatCurrency(shippingTotal)}</p>
              <p className="mt-1">Sellers: {sellerGroups.length}</p>
            </div>
            {sellerGroups.length > 1 ? (
              <p className="mt-4 rounded-[1.25rem] bg-amber-100 px-4 py-3 text-sm text-amber-950">
                Multi-seller cart is on. Checkout each seller group separately below so payouts and fulfillment stay accurate.
              </p>
            ) : cartListings.length ? (
              <div className="mt-6">
                <Link
                  href={`/checkout?sellerId=${encodeURIComponent(sellerGroups[0].sellerId)}`}
                  className="inline-flex w-full items-center justify-center rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white"
                >
                  Check Out
                </Link>
              </div>
            ) : null}
            {!stripeEnabled ? (
              <p className="mt-4 rounded-[1.25rem] bg-stone-100 px-4 py-3 text-sm text-stone-700">
                Stripe must be configured before orders can be placed.
              </p>
            ) : null}
            {user ? null : (
              <p className="mt-4 rounded-[1.25rem] bg-stone-100 px-4 py-3 text-sm text-stone-700">
                You’ll be asked to log in before checkout if you aren’t already signed in.
              </p>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
