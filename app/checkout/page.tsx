import Link from "next/link";
import { redirect } from "next/navigation";
import { startCartStripeCheckoutAction } from "@/app/actions";
import { CheckoutAddressFields } from "@/components/checkout-address-fields";
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

export default async function CheckoutPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  await ensureSeedData();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?authError=Please+log+in+or+create+an+account+to+check+out");
  }

  const requestedSellerId = firstValue(params.sellerId);
  const cartIds = await getCartIds();
  const marketplace = await listMarketplace();
  const cartListings = marketplace.filter((listing) => cartIds.includes(listing.id) && listing.status === "active");

  if (!cartListings.length) {
    redirect("/cart");
  }

  const sellerGroups = Array.from(
    cartListings.reduce(
      (groups, listing) => {
        const current = groups.get(listing.sellerId);
        if (current) {
          current.push(listing);
        } else {
          groups.set(listing.sellerId, [listing]);
        }
        return groups;
      },
      new Map<string, typeof cartListings>()
    )
  );

  const selectedSellerId =
    requestedSellerId && sellerGroups.some(([sellerId]) => sellerId === requestedSellerId)
      ? requestedSellerId
      : sellerGroups.length === 1
        ? sellerGroups[0][0]
        : null;

  if (!selectedSellerId) {
    redirect(
      `/cart?checkoutError=${encodeURIComponent(
        "Choose which seller group you want to check out first."
      )}`
    );
  }

  const selectedListings = cartListings.filter((listing) => listing.sellerId === selectedSellerId);
  const selectedSellerName = selectedListings[0]?.sellerDisplayName || "Seller";

  if (!selectedListings.length) {
    redirect("/cart");
  }

  const savedAddresses =
    user.buyerProfile.addresses.length
      ? user.buyerProfile.addresses.filter((address) => address.line1 && address.city && address.state && address.postalCode)
      : user.buyerProfile.address?.line1
        ? [user.buyerProfile.address]
        : [];

  const subtotal = selectedListings.reduce((sum, listing) => sum + listing.price, 0);
  const shippingTotal = selectedListings.reduce((sum, listing) => sum + listing.shippingPrice, 0);
  const total = subtotal + shippingTotal;
  const stripeEnabled = isStripeConfigured();

  return (
    <main className="grain px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="panel rounded-[2rem] p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow text-xs text-stone-500">Checkout</p>
              <h1 className="mt-3 text-4xl font-semibold text-stone-950">Review and purchase</h1>
              <p className="mt-3 text-sm text-stone-700">
                You are checking out the items in your cart from <strong>@{selectedSellerName}</strong>.
              </p>
            </div>
            <Link
              href="/cart"
              className="shrink-0 self-start rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800"
            >
              Back to Cart
            </Link>
          </div>

          {firstValue(params.checkoutError) ? (
            <p className="mt-4 rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">
              {firstValue(params.checkoutError)}
            </p>
          ) : null}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div className="grid gap-4">
            {selectedListings.map((listing) => {
              const estimatedArrival = formatEstimatedArrivalRange(3, 7);

              return (
                <article key={listing.id} className="panel rounded-[1.75rem] p-4">
                  <div className="flex gap-4">
                    <div className="h-32 w-28 shrink-0 overflow-hidden rounded-2xl bg-stone-100">
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
                      <p className="mt-1 text-sm text-stone-600">@{listing.sellerDisplayName}</p>
                      <div className="mt-4 grid gap-2 text-sm text-stone-700 sm:grid-cols-2">
                        <span>Item Price: {formatCurrency(listing.price)}</span>
                        <span>Shipping: {formatCurrency(listing.shippingPrice)}</span>
                        <span>Allows Offers: {listing.allowOffers ? "Yes" : "No"}</span>
                        <span>Accepts Returns: {listing.returnsAccepted ? "Yes" : "No"}</span>
                        <span>Estimated Arrival: {estimatedArrival}</span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="panel rounded-[1.75rem] p-6">
            <p className="eyebrow text-xs text-stone-500">Order summary</p>
            <h2 className="mt-3 text-2xl font-semibold text-stone-950">Complete checkout</h2>
            <p className="mt-2 text-sm text-stone-700">
              Signed in as {user.name}. Seller group: @{selectedSellerName}.
            </p>
            <p className="mt-5 text-4xl font-semibold text-stone-950">{formatCurrency(total)}</p>
            <div className="mt-4 rounded-[1.5rem] bg-white p-4 text-sm text-stone-700">
              <p>Items: {selectedListings.length}</p>
              <p className="mt-1">Subtotal: {formatCurrency(subtotal)}</p>
              <p className="mt-1">Shipping: {formatCurrency(shippingTotal)}</p>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-stone-300 bg-white p-4">
              <p className="text-sm font-semibold text-stone-950">Shipping address</p>
              {stripeEnabled ? (
                <form action={startCartStripeCheckoutAction}>
                  {selectedListings.map((listing) => (
                    <input key={listing.id} type="hidden" name="listingIds" value={listing.id} />
                  ))}
                  <CheckoutAddressFields savedAddresses={savedAddresses} defaultFullName={user.name || ""} />
                  <button className="mt-4 w-full rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white">
                    Purchase Items
                  </button>
                </form>
              ) : (
                <div className="mt-4 rounded-[1.25rem] bg-stone-100 px-4 py-4 text-sm text-stone-700">
                  Stripe Checkout is required before orders can be placed.
                </div>
              )}
            </div>

            {sellerGroups.length > 1 ? (
              <p className="mt-4 rounded-[1.25rem] bg-stone-100 px-4 py-3 text-sm text-stone-700">
                The rest of your cart stays intact. After this order, you can come back and check out another seller group.
              </p>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}
