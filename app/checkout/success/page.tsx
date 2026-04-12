import Link from "next/link";
import { ClearPurchasedCartItems } from "@/components/clear-purchased-cart-items";
import { formatCurrency, formatDisplayValue, formatSizeLabel } from "@/lib/display";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { openIssueAction } from "@/app/actions";
import {
  findListingById,
  listOrdersByStripeCheckoutSessionId,
  markListingSold,
  markOrderPaidBySessionId
} from "@/lib/store";

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

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(date);
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function formatConfirmationCode(orderId: string) {
  return `TG-${orderId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function getTrackingLabel(carrier: string | null, trackingNumber: string | null, trackingStatus: string | null) {
  if (carrier && trackingNumber) {
    return trackingStatus ? `${carrier} - ${trackingNumber} (${formatDisplayValue(trackingStatus)})` : `${carrier} - ${trackingNumber}`;
  }

  return "Tracking will appear once the seller ships.";
}

function canCancelOrder(status: string) {
  return ["pending_payment", "paid", "processing"].includes(status);
}

export default async function CheckoutSuccessPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const sessionId = firstValue(params.session_id);
  const saved = firstValue(params.saved);
  let purchasedListingIds: string[] = [];
  let purchasedOrders = [] as Awaited<ReturnType<typeof listOrdersByStripeCheckoutSessionId>>;

  if (sessionId && isStripeConfigured()) {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const orders = await listOrdersByStripeCheckoutSessionId(sessionId);
    purchasedOrders = orders;

    if (orders.length && session.payment_status === "paid") {
      purchasedListingIds = orders.map((order) => order.listingId);
      await markOrderPaidBySessionId(
        sessionId,
        typeof session.payment_intent === "string" ? session.payment_intent : null
      );
      await Promise.all(
        orders.map(async (order) => {
          const listing = await findListingById(order.listingId);
          if (listing?.status === "active") {
            await markListingSold(order.listingId);
          }
        })
      );
    }
  }

  const purchasedItems = await Promise.all(
    purchasedOrders.map(async (order) => {
      const listing = await findListingById(order.listingId);
      const purchasedAt = new Date(order.createdAt);
      const processingDays = listing?.processingDays ?? 3;
      const estimatedShipBy = addBusinessDays(purchasedAt, processingDays);
      const estimatedArrival = order.shippingEta ? new Date(order.shippingEta) : addBusinessDays(estimatedShipBy, 5);

      return {
        order,
        listing,
        confirmationCode: formatConfirmationCode(order.id),
        estimatedShipBy,
        estimatedArrival
      };
    })
  );

  const subtotal = purchasedOrders.reduce((sum, order) => sum + order.subtotal, 0);
  const shippingTotal = purchasedOrders.reduce((sum, order) => sum + order.shippingAmount, 0);
  const total = purchasedOrders.reduce((sum, order) => sum + order.amount, 0);
  const primaryConfirmationCode = purchasedItems[0]?.confirmationCode ?? null;

  return (
    <main className="grain px-4 py-10 sm:px-6 lg:px-8">
      <ClearPurchasedCartItems listingIds={purchasedListingIds} />
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="panel rounded-[2rem] p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow text-xs text-stone-500">Purchase Received</p>
              <h1 className="mt-4 text-4xl font-semibold text-stone-950">Thank you for your purchase</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-700">
                Your payment has been recorded and your order is now in the seller&apos;s queue to prepare for shipment.
              </p>
            </div>
            {primaryConfirmationCode ? (
              <div className="rounded-[1.5rem] border border-stone-300 bg-white px-5 py-4 text-right">
                <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Confirmation Code</p>
                <p className="mt-2 text-2xl font-semibold text-stone-950">{primaryConfirmationCode}</p>
              </div>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-[1.5rem] bg-white px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Items</p>
              <p className="mt-2 text-lg font-semibold text-stone-950">{purchasedOrders.length}</p>
            </div>
            <div className="rounded-[1.5rem] bg-white px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Subtotal</p>
              <p className="mt-2 text-lg font-semibold text-stone-950">{formatCurrency(subtotal)}</p>
            </div>
            <div className="rounded-[1.5rem] bg-white px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Shipping</p>
              <p className="mt-2 text-lg font-semibold text-stone-950">{formatCurrency(shippingTotal)}</p>
            </div>
            <div className="rounded-[1.5rem] bg-white px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Total Paid</p>
              <p className="mt-2 text-lg font-semibold text-stone-950">{formatCurrency(total)}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/buyer/orders" className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
              View My Purchases
            </Link>
            <Link href="/" className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800">
              Back to Marketplace
            </Link>
            <Link href="/cart" className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800">
              View Cart
            </Link>
          </div>
          {saved === "issue" ? (
            <div className="mt-4 rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-950">
              Your request has been sent to the seller for review.
            </div>
          ) : null}
        </section>

        {purchasedItems.length ? (
          <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="grid gap-4">
              {purchasedItems.map(({ order, listing, confirmationCode, estimatedShipBy, estimatedArrival }) => (
                <article key={order.id} className="panel rounded-[1.75rem] p-5">
                  <div className="flex gap-4">
                    <div className="h-32 w-28 shrink-0 overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
                      {listing?.media[0] ? (
                        listing.media[0].kind === "video" ? (
                          <video src={listing.media[0].url} className="h-full w-full object-cover" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={listing.media[0].url} alt={order.listingTitle} className="h-full w-full object-cover" />
                        )
                      ) : (
                        <div className="flex h-full items-center justify-center px-2 text-center text-xs text-stone-500">Media</div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {listing ? (
                          <>
                            <span className="rounded-full bg-stone-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-50">
                              {formatDisplayValue(listing.category)}
                            </span>
                            <span className="rounded-full bg-[rgba(186,108,59,0.12)] px-3 py-1 text-[11px] font-medium tracking-[0.16em] text-[var(--accent)]">
                              {formatSizeLabel(listing.sizeLabel) || "None"}
                            </span>
                          </>
                        ) : null}
                      </div>

                      <h2 className="mt-3 text-2xl font-semibold text-stone-950">{order.listingTitle}</h2>
                      <p className="mt-1 text-sm text-stone-700">
                        Sold by{" "}
                        <Link href={`/users/${order.sellerName}`} className="font-semibold transition hover:text-[var(--accent)]">
                          @{order.sellerName}
                        </Link>
                      </p>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Order Code</p>
                          <p className="mt-1 text-sm font-semibold text-stone-900">{confirmationCode}</p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Amount Paid</p>
                          <p className="mt-1 text-sm font-semibold text-stone-900">{formatCurrency(order.amount)}</p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Estimated Ship By</p>
                          <p className="mt-1 text-sm font-semibold text-stone-900">{formatLongDate(estimatedShipBy)}</p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Estimated Arrival</p>
                          <p className="mt-1 text-sm font-semibold text-stone-900">{formatShortDate(estimatedArrival)}</p>
                        </div>
                      </div>

                      <div className="mt-3 rounded-2xl bg-white px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Tracking</p>
                        <p className="mt-1 text-sm font-semibold text-stone-900">
                          {getTrackingLabel(order.carrier, order.trackingNumber, order.trackingStatus)}
                        </p>
                        {order.trackingUrl ? (
                          <a
                            href={order.trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex text-sm text-[var(--accent)] underline decoration-stone-300 underline-offset-4"
                          >
                            Open tracking
                          </a>
                        ) : null}
                      </div>
                      {canCancelOrder(order.status) ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <form action={openIssueAction}>
                            <input type="hidden" name="orderId" value={order.id} />
                            <input type="hidden" name="issueReason" value="Cancellation requested by buyer" />
                            <input
                              type="hidden"
                              name="returnTo"
                              value={`/checkout/success?session_id=${encodeURIComponent(sessionId ?? "")}&saved=issue`}
                            />
                            <button className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950">
                              Request Cancellation
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <aside className="panel rounded-[1.75rem] p-6">
              <p className="eyebrow text-xs text-stone-500">What Happens Next</p>
              <h2 className="mt-3 text-2xl font-semibold text-stone-950">Shipping and tracking</h2>
              <div className="mt-5 grid gap-3 text-sm text-stone-700">
                <div className="rounded-[1.25rem] bg-white px-4 py-4">
                  The seller will package your order and add tracking once the parcel is prepared.
                </div>
                <div className="rounded-[1.25rem] bg-white px-4 py-4">
                  You can review current and past orders anytime from <span className="font-semibold text-stone-950">My Purchases</span>.
                </div>
                <div className="rounded-[1.25rem] bg-white px-4 py-4">
                  Shipping updates will appear there as soon as the seller marks the order shipped.
                </div>
              </div>
            </aside>
          </section>
        ) : (
          <section className="panel rounded-[1.75rem] p-6 text-sm text-stone-700">
            We couldn&apos;t load item-level order details from this session yet, but you can still review your purchases from
            {" "}
            <Link href="/buyer/orders" className="font-semibold text-[var(--accent)]">
              My Purchases
            </Link>
            .
          </section>
        )}
      </div>
    </main>
  );
}
