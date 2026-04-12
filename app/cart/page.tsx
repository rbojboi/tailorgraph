import Link from "next/link";
import {
  removeFromCartAction
} from "@/app/actions";
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
  const sellerCount = new Set(cartListings.map((listing) => listing.sellerId)).size;
  const hasMultipleSellers = sellerCount > 1;

  return (
    <main className="grain px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="panel rounded-[2rem] p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow text-xs text-stone-500">Cart</p>
              <h1 className="mt-3 text-4xl font-semibold text-stone-950">Checkout and ordering</h1>
              <p className="mt-3 text-sm text-stone-700">
                {stripeEnabled
                  ? "Stripe Checkout is enabled for hosted card payments."
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

        <section className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="grid gap-4">
            {cartListings.length ? (
              cartListings.map((listing) => {
                const estimatedArrival = formatEstimatedArrivalRange(3, 7);

                return (
                  <article
                    key={listing.id}
                    className="rounded-[1.75rem] border border-stone-300 bg-[rgba(120,113,108,0.08)] p-4 shadow-[0_10px_30px_rgba(28,25,23,0.04)]"
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
                            <div className="flex h-full items-center justify-center px-2 text-center text-xs text-stone-500">Media</div>
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
              })
            ) : (
              <article className="panel rounded-[1.75rem] p-8 text-center text-stone-700">
                Your cart is empty.
              </article>
            )}
          </div>

          <aside className="panel h-fit self-start rounded-[1.75rem] p-6">
            <p className="eyebrow text-xs text-stone-500">Order summary</p>
            <h2 className="mt-3 text-2xl font-semibold text-stone-950">Order Total:</h2>
            <p className="mt-5 text-4xl font-semibold text-stone-950">{formatCurrency(total)}</p>
            <div className="mt-4 rounded-[1.5rem] bg-white p-4 text-sm text-stone-700">
              <p>Items: {cartListings.length}</p>
              <p className="mt-1">Subtotal: {formatCurrency(subtotal)}</p>
              <p className="mt-1">Shipping: {formatCurrency(shippingTotal)}</p>
            </div>
            {hasMultipleSellers ? (
              <p className="mt-4 rounded-[1.25rem] bg-amber-100 px-4 py-3 text-sm text-amber-950">
                For now, checkout supports one seller at a time. Remove items from other sellers and check out separately.
              </p>
            ) : null}

            {cartListings.length ? (
              <div className="mt-6">
                {hasMultipleSellers ? (
                  <button
                    disabled
                    className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-full bg-stone-300 px-4 py-3 text-sm font-semibold text-stone-600"
                  >
                    Check Out
                  </button>
                ) : (
                  <Link
                    href="/checkout"
                    className="inline-flex w-full items-center justify-center rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white"
                  >
                    Check Out
                  </Link>
                )}
              </div>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}
