import Link from "next/link";
import { redirect } from "next/navigation";
import { saveOrderReviewAction } from "@/app/actions";
import { BuyerSubpageHeader } from "@/components/buyer-subpage-header";
import { RatingStarsInput } from "@/components/rating-stars-input";
import { AppShell, PageWrap } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeedData, findOrderById } from "@/lib/store";

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

function formatShortDate(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(dateString));
}

function formatLongDate(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(dateString));
}

function getTrackingUrl(carrier: string, trackingNumber: string) {
  const normalizedCarrier = carrier.toLowerCase();
  const encodedTracking = encodeURIComponent(trackingNumber);

  if (normalizedCarrier.includes("postal") || normalizedCarrier.includes("usps")) {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodedTracking}`;
  }

  if (normalizedCarrier.includes("ups")) {
    return `https://www.ups.com/track?tracknum=${encodedTracking}`;
  }

  if (normalizedCarrier.includes("fedex")) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodedTracking}`;
  }

  if (normalizedCarrier.includes("dhl")) {
    return `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${encodedTracking}`;
  }

  return null;
}

function getBuyerPurchaseStatus(order: { status: string; returnsAccepted: boolean; deliveredAt: string | null }) {
  if (["canceled", "refunded", "failed"].includes(order.status)) {
    return "Canceled";
  }

  if (order.status === "shipped" || order.status === "issue_open") {
    return "Shipped";
  }

  if (order.status === "delivered") {
    if (!order.returnsAccepted) {
      return "Delivered";
    }

    if (order.deliveredAt) {
      const returnWindowEnds = addBusinessDays(new Date(order.deliveredAt), 7);
      if (returnWindowEnds < new Date()) {
        return "Return Expired";
      }
    }

    return "Return Eligible";
  }

  return "Paid";
}

function getBuyerDeliveryLabel(order: { status: string; createdAt: string; shippedAt: string | null; deliveredAt: string | null }) {
  if (order.status === "delivered" && order.deliveredAt) {
    return formatLongDate(order.deliveredAt);
  }

  const deliveryBase = order.shippedAt ?? order.createdAt;
  return `Expected ${formatShortDate(addBusinessDays(new Date(deliveryBase), 5).toISOString())}`;
}

function reviewHasDetailedContent(order: {
  reviewMeasurementRating: number | null;
  reviewConditionRating: number | null;
  reviewShippingRating: number | null;
  reviewCommunicationRating: number | null;
  reviewFeedback: string;
}) {
  return Boolean(
    order.reviewMeasurementRating ||
      order.reviewConditionRating ||
      order.reviewShippingRating ||
      order.reviewCommunicationRating ||
      order.reviewFeedback.trim()
  );
}

function StaticRatingRow({
  label,
  value,
  overall = false
}: {
  label: string;
  value: number | null;
  overall?: boolean;
}) {
  const filled = value ?? 0;

  return (
    <div className={overall ? "grid justify-items-center gap-3 text-center" : "flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"}>
      <p className={overall ? "text-sm font-semibold uppercase tracking-[0.22em] text-stone-500" : "text-sm font-medium text-stone-700"}>
        {label}
      </p>
      <div className={overall ? "rounded-full border border-stone-300 bg-white px-4 py-3 shadow-[0_12px_30px_-24px_rgba(28,25,23,0.5)]" : "rounded-full border border-stone-300 bg-white px-3 py-2"}>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((ratingValue) => (
            <span
              key={ratingValue}
              className={`leading-none ${overall ? "text-[1.9rem]" : "text-2xl"} ${filled >= ratingValue ? "text-amber-500" : "text-stone-300"}`}
            >
              ★
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function RateOrderPage({
  params,
  searchParams
}: {
  params: Promise<{ orderId: string }>;
  searchParams: SearchParams;
}) {
  await ensureSeedData();
  const { orderId } = await params;
  const resolvedSearchParams = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/?authError=Please+log+in+to+access+the+buyer+dashboard");
  }

  const order = await findOrderById(orderId);
  if (!order || order.buyerId !== user.id) {
    redirect("/buyer/orders?authError=Order+not+found");
  }

  const authError = firstValue(resolvedSearchParams.authError);
  const requestedOverallRating = firstValue(resolvedSearchParams.overallRating);
  const parsedOverallRating = requestedOverallRating ? Number(requestedOverallRating) : null;
  const defaultOverallRating =
    parsedOverallRating && parsedOverallRating >= 1 && parsedOverallRating <= 5
      ? parsedOverallRating
      : order.reviewOverallRating;
  const reviewLocked = reviewHasDetailedContent(order);

  return (
    <AppShell>
      <PageWrap>
        <BuyerSubpageHeader
          eyebrow="Buyer Dashboard"
          title="Rate Order"
          actionHref="/buyer/orders"
          actionLabel="Back to My Purchases"
        />

        {authError ? (
          <p className="rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">{decodeURIComponent(authError.replace(/\+/g, " "))}</p>
        ) : null}

        <section className="panel rounded-[1.75rem] p-6">
          <article className="relative overflow-visible rounded-[1.5rem] border border-stone-300 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link href={`/listings/${order.listingId}`} className="text-sm font-semibold text-stone-950 transition hover:text-[var(--accent)]">
                  {order.listingTitle}
                </Link>
                <p className="mt-1 text-sm text-stone-700">
                  Paid ${order.subtotal.toFixed(2)}
                  {order.shippingAmount > 0 ? ` (+ $${order.shippingAmount.toFixed(2)} shipping)` : ""} -{" "}
                  <Link href={`/users/${order.sellerName}`} className="font-semibold transition hover:text-[var(--accent)]">
                    @{order.sellerName}
                  </Link>
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white px-3 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Status</p>
                <div className="mt-1 text-sm font-semibold text-stone-900">{getBuyerPurchaseStatus(order)}</div>
              </div>
              <div className="rounded-2xl bg-white px-3 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Delivery</p>
                <div className="mt-1 text-sm font-semibold text-stone-900">{getBuyerDeliveryLabel(order)}</div>
              </div>
              <div className="rounded-2xl bg-white px-3 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Carrier</p>
                <div className="mt-1 text-sm font-semibold text-stone-900">
                  {order.carrier ? (
                    (() => {
                      const trackingUrl = order.trackingNumber ? getTrackingUrl(order.carrier, order.trackingNumber) : null;
                      return trackingUrl ? (
                        <a href={trackingUrl} target="_blank" rel="noreferrer" className="underline decoration-stone-300 underline-offset-4 transition hover:text-[var(--accent)]">
                          {order.carrier}
                        </a>
                      ) : (
                        order.carrier
                      );
                    })()
                  ) : (
                    "Pending"
                  )}
                </div>
              </div>
            </div>
          </article>

          {reviewLocked ? (
            <div className="mt-5 grid gap-5">
              <div className="rounded-[1.5rem] border border-stone-300 bg-stone-50/80 px-5 py-4">
                <StaticRatingRow label="Measurement Accuracy" value={order.reviewMeasurementRating} />
                <StaticRatingRow label="Condition Accuracy" value={order.reviewConditionRating} />
                <StaticRatingRow label="Shipping Speed and Handling" value={order.reviewShippingRating} />
                <StaticRatingRow label="Communication" value={order.reviewCommunicationRating} />
                <div className="mt-2 border-t border-stone-200 pt-5">
                  <StaticRatingRow label="Overall Rating" value={order.reviewOverallRating} overall />
                </div>
                <div className="mt-5 grid gap-2 border-t border-stone-200 pt-5 text-sm font-medium text-stone-700">
                  <span>Feedback</span>
                  <div className="rounded-[1.25rem] border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700">
                    {order.reviewFeedback || "No written feedback provided."}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-900">
                <span>Review saved. Reviews cannot be edited once submitted.</span>
                <Link
                  href="/buyer"
                  className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-semibold text-emerald-900 transition hover:border-emerald-500"
                >
                  Back to Buyer Dashboard
                </Link>
              </div>
            </div>
          ) : (
            <form action={saveOrderReviewAction} className="mt-5 grid gap-5">
              <input type="hidden" name="orderId" value={order.id} />

              <div className="rounded-[1.5rem] border border-stone-300 bg-stone-50/80 px-5 py-4">
                <RatingStarsInput name="measurementRating" label="Measurement Accuracy" defaultValue={order.reviewMeasurementRating} />
                <RatingStarsInput name="conditionRating" label="Condition Accuracy" defaultValue={order.reviewConditionRating} />
                <RatingStarsInput name="shippingRating" label="Shipping Speed and Handling" defaultValue={order.reviewShippingRating} />
                <RatingStarsInput name="communicationRating" label="Communication" defaultValue={order.reviewCommunicationRating} />
                <div className="mt-2 border-t border-stone-200 pt-5">
                  {order.reviewOverallRating !== null ? (
                    <>
                      <input type="hidden" name="overallRating" value={String(order.reviewOverallRating)} />
                      <StaticRatingRow label="Overall Rating" value={order.reviewOverallRating} overall />
                    </>
                  ) : (
                    <RatingStarsInput
                      name="overallRating"
                      label="Overall Rating"
                      defaultValue={defaultOverallRating}
                      variant="overall"
                    />
                  )}
                </div>
                <label className="mt-5 grid gap-2 border-t border-stone-200 pt-5 text-sm font-medium text-stone-700">
                  <span>Feedback</span>
                  <textarea
                    name="feedback"
                    defaultValue={order.reviewFeedback}
                    rows={6}
                    maxLength={1000}
                    className="rounded-[1.25rem] border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-stone-950"
                    placeholder="Add any additional feedback about the item, shipping, or seller."
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-3">
                <button className="rounded-full bg-stone-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-stone-800">
                  Save Review
                </button>
                <Link
                  href="/buyer/orders"
                  className="rounded-full border border-stone-300 bg-white px-5 py-2 text-sm font-semibold text-stone-900"
                >
                  Cancel
                </Link>
              </div>
            </form>
          )}
        </section>
      </PageWrap>
    </AppShell>
  );
}
