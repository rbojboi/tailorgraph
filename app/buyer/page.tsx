import Link from "next/link";
import { redirect } from "next/navigation";
import { filterAndSortMarketplaceListings } from "@/app/marketplace/page";
import {
  addToCartAction,
  buyNowAction,
  deleteSavedSearchAction,
  renameSavedSearchAction,
  toggleSaveListingAction
} from "@/app/actions";
import { BuyerOfferActionsMenu } from "@/components/buyer-offer-actions-menu";
import { BuyerOfferFilterControl } from "@/components/buyer-offer-filter-control";
import { BuyerPurchaseActionsMenu } from "@/components/buyer-purchase-actions-menu";
import { BuyerPurchaseFilterControl } from "@/components/buyer-purchase-filter-control";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { OrderRatingStars } from "@/components/order-rating-stars";
import { AppShell, PageWrap, Spec } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency, formatDisplayValue, formatSizeLabel } from "@/lib/display";
import type { OfferStatus } from "@/lib/types";
import {
  ensureSeedData,
  listBuyerOffers,
  listBuyerOrders,
  listListingsFromFollowedUsers,
  listMarketplace,
  listSavedListingsForUser,
  listSavedSearchesForUser
} from "@/lib/store";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function savedSearchHref(savedSearch: { id: string; queryString: string }) {
  return savedSearch.queryString ? `/marketplace?savedSearchId=${savedSearch.id}&${savedSearch.queryString}` : `/marketplace?savedSearchId=${savedSearch.id}`;
}

function savedSearchFilters(queryString: string) {
  const params = new URLSearchParams(queryString);
  const filters: Record<string, string | string[]> = {};

  for (const [key, value] of params.entries()) {
    const existing = filters[key];
    if (existing === undefined) {
      filters[key] = value;
      continue;
    }

    filters[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
  }

  return filters;
}

type BuyerOfferFilter = OfferStatus | "all";
type BuyerPurchaseFilter = "all" | "return_eligible" | "shipped" | "delivered" | "canceled";

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

function getPurchaseFilterLabel(filter: BuyerPurchaseFilter) {
  switch (filter) {
    case "return_eligible":
      return "return eligible";
    case "shipped":
      return "shipped";
    case "delivered":
      return "delivered";
    case "canceled":
      return "canceled";
    default:
      return "";
  }
}

function getOfferTimeRemainingLabel(offer: { status: OfferStatus; createdAt: string }) {
  if (offer.status !== "active") {
    return "Closed";
  }

  const expiresAt = new Date(new Date(offer.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000);
  const remainingMs = expiresAt.getTime() - Date.now();

  if (remainingMs <= 0) {
    return "Expired";
  }

  const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  return `${remainingDays} day${remainingDays === 1 ? "" : "s"}`;
}

function canReturnOrder(order: {
  status: string;
  returnsAccepted: boolean;
  deliveredAt: string | null;
}) {
  return getBuyerPurchaseStatus(order) === "Return Eligible";
}

function canReportIssue(order: { status: string }) {
  return order.status !== "failed";
}

function canRateOrder(order: {
  status: string;
  reviewMeasurementRating: number | null;
  reviewConditionRating: number | null;
  reviewShippingRating: number | null;
  reviewCommunicationRating: number | null;
  reviewFeedback: string;
}) {
  if (["canceled", "refunded", "failed"].includes(order.status)) {
    return false;
  }

  return !Boolean(
    order.reviewMeasurementRating ||
      order.reviewConditionRating ||
      order.reviewShippingRating ||
      order.reviewCommunicationRating ||
      order.reviewFeedback.trim()
  );
}

function filterBuyerOrders<T extends { status: string; returnsAccepted: boolean; deliveredAt: string | null }>(
  orders: T[],
  filter: BuyerPurchaseFilter
) {
  if (filter === "canceled") {
    return orders.filter((order) => ["canceled", "refunded", "failed"].includes(order.status));
  }

  if (filter === "return_eligible") {
    return orders.filter((order) => getBuyerPurchaseStatus(order) === "Return Eligible");
  }

  if (filter === "shipped") {
    return orders.filter((order) => ["shipped", "issue_open"].includes(order.status));
  }

  if (filter === "delivered") {
    return orders.filter((order) => ["Delivered", "Return Expired"].includes(getBuyerPurchaseStatus(order)));
  }

  return orders;
}

export default async function BuyerPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  await ensureSeedData();
  const params = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/?authError=Please+log+in+to+access+the+buyer+dashboard");
  }

  const requestedOfferStatus = firstValue(params.offerStatus) as BuyerOfferFilter | undefined;
  const selectedOfferStatus: BuyerOfferFilter =
    requestedOfferStatus && ["all", "active", "accepted", "rejected"].includes(requestedOfferStatus)
      ? requestedOfferStatus
      : "all";
  const requestedPurchaseStatus = firstValue(params.purchaseStatus) as BuyerPurchaseFilter | undefined;
  const selectedPurchaseStatus: BuyerPurchaseFilter =
    requestedPurchaseStatus && ["all", "return_eligible", "shipped", "delivered", "canceled"].includes(requestedPurchaseStatus)
      ? requestedPurchaseStatus
      : "all";
  const [orders, offers, savedListings, savedUserListings, savedSearches, marketplace] = await Promise.all([
    listBuyerOrders(user.id),
    listBuyerOffers(user.id, selectedOfferStatus),
    listSavedListingsForUser(user.id),
    listListingsFromFollowedUsers(user.id, 24),
    listSavedSearchesForUser(user.id),
    listMarketplace()
  ]);
  const savedSearchCounts = new Map(
    savedSearches.map((savedSearch) => [
      savedSearch.id,
      filterAndSortMarketplaceListings({
        sourceListings: marketplace,
        filters: savedSearchFilters(savedSearch.queryString),
        buyerProfile: user.buyerProfile,
        defaultSort: "recommended"
      }).totalListings
    ])
  );
  const editingSavedSearchId = firstValue(params.renameSearch);
  const cartAdded = firstValue(params.cartAdded);
  const saved = firstValue(params.saved);
  const authError = firstValue(params.authError);
  const ratedOrder = firstValue(params.ratedOrder);
  const filteredOrders = filterBuyerOrders(orders, selectedPurchaseStatus);

  return (
    <AppShell>
      <PageWrap>
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="eyebrow text-xs text-stone-500">Buyer Dashboard</p>
              <h1 className="mt-3 text-4xl font-semibold text-stone-950">{user.name}</h1>
              <p className="mt-3 text-sm text-stone-700">{user.buyerProfile.location || "Location Not Yet Added"}</p>
              <Link
                href="/buyer/measurements"
                className="mt-3 inline-flex text-sm font-semibold text-[var(--accent)] transition hover:text-stone-950"
              >
                Go to My Measurements
              </Link>
            </div>
          </div>
        </section>

        {authError ? (
          <p className="rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">{authError}</p>
        ) : null}
        {cartAdded ? (
          <div
            className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm ${
              cartAdded === "existing" ? "bg-rose-100 text-rose-900" : "bg-emerald-100 text-emerald-900"
            }`}
          >
            <span>{cartAdded === "existing" ? "Item already in cart." : "Item added to cart."}</span>
            <Link
              href="/cart"
              className={`rounded-full bg-white px-3 py-1 text-xs font-semibold transition ${
                cartAdded === "existing"
                  ? "border border-rose-300 text-rose-900 hover:border-rose-500"
                  : "border border-emerald-300 text-emerald-900 hover:border-emerald-500"
              }`}
            >
              View Cart
            </Link>
          </div>
        ) : null}
        {saved ? (
          saved === "rating" && ratedOrder ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-900">
              <span>Rating saved.</span>
              <Link href={`/buyer/orders/${ratedOrder}/rate`} className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-semibold text-emerald-900 transition hover:border-emerald-500">
                Add More Details
              </Link>
            </div>
          ) : (
            <p className="rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-900">
              {saved === "offer" ? "Offer Sent." : `Saved ${saved}.`}
            </p>
          )
        ) : null}

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="contents">
            <article className="panel overflow-visible rounded-[1.75rem] p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="eyebrow text-xs text-stone-500">Offers</p>
                  <h2 className="mt-3 text-2xl font-semibold text-stone-950">
                    <Link href="/buyer/offers" className="transition hover:text-[var(--accent)]">
                      My Offers
                    </Link>
                  </h2>
                </div>
                <div className="mt-7 flex items-center gap-3">
                  <BuyerOfferFilterControl currentFilter={selectedOfferStatus} />
                </div>
              </div>
              <div className="mt-4 max-h-[33rem] overflow-y-auto pr-2">
                <div className="grid gap-3">
                  {offers.length ? (
                    offers.map((offer) => (
                      <article key={offer.id} className="relative overflow-visible rounded-[1.5rem] border border-stone-300 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 pr-12">
                          <div>
                            <Link
                              href={`/listings/${offer.listingId}`}
                              className="text-sm font-semibold text-stone-950 transition hover:text-[var(--accent)]"
                            >
                              {offer.listingTitle}
                            </Link>
                            <p className="mt-1 text-sm text-stone-700">
                              Offered {formatCurrency(offer.amount)} to{" "}
                              <Link href={`/users/${offer.sellerUsername}`} className="font-semibold transition hover:text-[var(--accent)]">
                                @{offer.sellerUsername}
                              </Link>
                            </p>
                          </div>
                        </div>
                        <div className="absolute right-4 top-4">
                          <BuyerOfferActionsMenu listingId={offer.listingId} />
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <Spec label="Status" value={offer.status.charAt(0).toUpperCase() + offer.status.slice(1)} />
                          <Spec label="Time Remaining" value={getOfferTimeRemainingLabel(offer)} />
                          <Spec label="Listed Price" value={formatCurrency(offer.listingPrice)} />
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-[1.5rem] border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-600">
                      No {selectedOfferStatus === "all" ? "" : `${selectedOfferStatus} `}offers yet.
                    </div>
                  )}
                </div>
              </div>
            </article>

            <article className="panel rounded-[1.75rem] p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="eyebrow text-xs text-stone-500">Orders</p>
                  <h2 className="mt-3 text-2xl font-semibold text-stone-950">
                    <Link href="/buyer/orders" className="transition hover:text-[var(--accent)]">
                      My Purchases
                    </Link>
                  </h2>
                </div>
                <div className="mt-7 flex items-center gap-3">
                  <BuyerPurchaseFilterControl currentFilter={selectedPurchaseStatus} />
                </div>
              </div>
              <div className="mt-4 max-h-[33rem] overflow-y-auto pr-2">
                <div className="grid gap-3">
                  {filteredOrders.length ? (
                    filteredOrders.map((order) => (
                      <article key={order.id} className="relative overflow-visible rounded-[1.5rem] border border-stone-300 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 pr-28">
                          <div>
                            <Link
                              href={`/listings/${order.listingId}`}
                              className="text-sm font-semibold text-stone-950 transition hover:text-[var(--accent)]"
                            >
                            {order.listingTitle}
                          </Link>
                          <p className="mt-1 text-sm text-stone-700">
                            Paid {formatCurrency(order.subtotal)}{order.shippingAmount > 0 ? ` (+ ${formatCurrency(order.shippingAmount)} shipping)` : ""} to{" "}
                            <Link href={`/users/${order.sellerName}`} className="font-semibold transition hover:text-[var(--accent)]">
                              @{order.sellerName}
                            </Link>
                          </p>
                          </div>
                          <div className="absolute right-14 top-4">
                            <OrderRatingStars
                              orderId={order.id}
                              currentRating={order.reviewOverallRating}
                              returnTo={`/buyer?purchaseStatus=${selectedPurchaseStatus}`}
                            />
                          </div>
                        </div>
                        <div className="absolute right-4 top-4">
                          <BuyerPurchaseActionsMenu
                            listingId={order.listingId}
                            orderId={order.id}
                            canRate={canRateOrder(order)}
                            canConfirmDelivery={order.status === "shipped" || order.status === "processing"}
                            canCancel={["pending_payment", "paid", "processing"].includes(order.status)}
                            canReturn={canReturnOrder(order)}
                            canReportIssue={canReportIssue(order)}
                            returnTo={`/buyer?purchaseStatus=${selectedPurchaseStatus}&saved=issue`}
                          />
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <Spec label="Status" value={getBuyerPurchaseStatus(order)} />
                          <Spec label="Delivery" value={getBuyerDeliveryLabel(order)} />
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
                    ))
                  ) : (
                    <div className="rounded-[1.5rem] border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-600">
                      No {selectedPurchaseStatus === "all" ? "" : `${getPurchaseFilterLabel(selectedPurchaseStatus)} `}purchases yet.
                    </div>
                  )}
                </div>
              </div>
            </article>

            <article className="panel rounded-[1.75rem] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow text-xs text-stone-500">Saved</p>
                  <h2 className="mt-3 text-2xl font-semibold text-stone-950">
                    <Link href="/buyer/saved-items" className="transition hover:text-[var(--accent)]">
                      Saved Items
                    </Link>
                  </h2>
                </div>
              </div>
              <div className="mt-5 max-h-[33rem] overflow-y-auto pr-2">
                <div className="grid gap-4 md:grid-cols-2">
                  {savedListings.length ? (
                    savedListings.map((listing) => (
                    <article key={listing.id} className="panel relative flex h-full flex-col rounded-[1.75rem] p-4">
                      <Link href={`/listings/${listing.id}`} className="absolute inset-0 rounded-[1.75rem]" aria-label={`View ${listing.title}`} />
                      <div className="pointer-events-none relative z-10 overflow-hidden rounded-[1.25rem] bg-stone-100">
                        <div className="aspect-[4/5] w-full">
                          {listing.media[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={listing.media[0].url} alt={listing.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-sm text-stone-500">Media will appear here</div>
                          )}
                        </div>
                        <div className="pointer-events-auto absolute right-3 top-3 z-20">
                          <form action={toggleSaveListingAction}>
                            <input type="hidden" name="listingId" value={listing.id} />
                            <input type="hidden" name="returnTo" value="/buyer" />
                            <button className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-900 transition">
                              Saved
                            </button>
                          </form>
                        </div>
                      </div>

                      <div className="pointer-events-none relative z-10 mt-4 flex flex-1 flex-col">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-stone-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-50">
                            {formatDisplayValue(listing.category)}
                          </span>
                          <span className="rounded-full bg-[rgba(186,108,59,0.12)] px-3 py-1 text-[11px] font-medium tracking-[0.16em] text-[var(--accent)]">
                            {formatSizeLabel(listing.sizeLabel) || "None"}
                          </span>
                        </div>
                        <h2 className="mt-3 line-clamp-2 text-lg font-semibold text-stone-950">{listing.title}</h2>
                        <p className="mt-2 text-sm text-stone-600">
                          <Link href={`/users/${listing.sellerDisplayName}`} className="pointer-events-auto transition hover:text-stone-950">
                            @{listing.sellerDisplayName}
                          </Link>
                        </p>
                        <p className="mt-4 text-2xl font-semibold text-stone-950">${listing.price.toFixed(2)}</p>
                      </div>

                      <div className="relative z-20 mt-4 grid grid-cols-2 gap-2">
                        <Link href={`/listings/${listing.id}`} className="inline-flex h-11 w-full items-center justify-center rounded-full bg-stone-950 px-2 text-center text-[13px] font-semibold leading-tight text-white">
                          View Item
                        </Link>
                        <form action={addToCartAction}>
                          <input type="hidden" name="listingId" value={listing.id} />
                          <input type="hidden" name="returnTo" value="/buyer" />
                          <button className="h-11 w-full rounded-full border border-stone-400 bg-stone-200 px-2 text-center text-[13px] font-semibold leading-tight text-stone-900">
                            Add to Cart
                          </button>
                        </form>
                        <form action={buyNowAction}>
                          <input type="hidden" name="listingId" value={listing.id} />
                          <button className="h-11 w-full rounded-full bg-[var(--accent)] px-2 text-center text-[13px] font-semibold leading-tight text-white">
                            Purchase
                          </button>
                        </form>
                        {listing.allowOffers ? (
                          <Link href={`/listings/${listing.id}?intent=offer`} className="inline-flex h-11 w-full items-center justify-center rounded-full border border-amber-300 bg-amber-100 px-2 text-center text-[13px] font-semibold leading-tight text-amber-900">
                            Make Offer
                          </Link>
                        ) : (
                          <div />
                        )}
                      </div>
                    </article>
                    ))
                  ) : (
                    <div className="rounded-[1.5rem] border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-600 md:col-span-2">
                      No saved items yet.
                    </div>
                  )}
                </div>
              </div>
            </article>

            <article className="panel rounded-[1.75rem] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow text-xs text-stone-500">Saved</p>
                  <h2 className="mt-3 text-2xl font-semibold text-stone-950">
                    <Link href="/buyer/saved-users" className="transition hover:text-[var(--accent)]">
                      Saved Users
                    </Link>
                  </h2>
                </div>
              </div>
              <div className="mt-5 max-h-[33rem] overflow-y-auto pr-2">
                <div className="grid gap-4 md:grid-cols-2">
                  {savedUserListings.length ? (
                    savedUserListings.map((listing) => (
                      <article key={listing.id} className="panel relative flex h-full flex-col rounded-[1.75rem] p-4">
                        <Link href={`/listings/${listing.id}`} className="absolute inset-0 rounded-[1.75rem]" aria-label={`View ${listing.title}`} />
                        <div className="pointer-events-none relative z-10 overflow-hidden rounded-[1.25rem] bg-stone-100">
                          <div className="aspect-[4/5] w-full">
                            {listing.media[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={listing.media[0].url} alt={listing.title} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-sm text-stone-500">Media will appear here</div>
                            )}
                          </div>
                          <div className="pointer-events-auto absolute right-3 top-3 z-20">
                            <form action={toggleSaveListingAction}>
                              <input type="hidden" name="listingId" value={listing.id} />
                              <input type="hidden" name="returnTo" value="/buyer" />
                              <button
                                className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                                  savedListings.some((savedListing) => savedListing.id === listing.id)
                                    ? "border border-emerald-300 bg-emerald-100 text-emerald-900"
                                    : "border border-stone-300 bg-white text-stone-700 hover:border-stone-950 hover:text-stone-950"
                                }`}
                              >
                                {savedListings.some((savedListing) => savedListing.id === listing.id) ? "Saved" : "Save Item"}
                              </button>
                            </form>
                          </div>
                        </div>

                        <div className="pointer-events-none relative z-10 mt-4 flex flex-1 flex-col">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-stone-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-50">
                              {formatDisplayValue(listing.category)}
                            </span>
                            <span className="rounded-full bg-[rgba(186,108,59,0.12)] px-3 py-1 text-[11px] font-medium tracking-[0.16em] text-[var(--accent)]">
                              {formatSizeLabel(listing.sizeLabel) || "None"}
                            </span>
                          </div>
                          <h2 className="mt-3 line-clamp-2 text-lg font-semibold text-stone-950">{listing.title}</h2>
                          <p className="mt-2 text-sm text-stone-600">
                            <Link href={`/users/${listing.sellerDisplayName}`} className="pointer-events-auto transition hover:text-stone-950">
                              @{listing.sellerDisplayName}
                            </Link>
                          </p>
                          <p className="mt-4 text-2xl font-semibold text-stone-950">${listing.price.toFixed(2)}</p>
                        </div>

                        <div className="relative z-20 mt-4 grid grid-cols-2 gap-2">
                          <Link href={`/listings/${listing.id}`} className="inline-flex h-11 w-full items-center justify-center rounded-full bg-stone-950 px-2 text-center text-[13px] font-semibold leading-tight text-white">
                            View Item
                          </Link>
                          <form action={addToCartAction}>
                            <input type="hidden" name="listingId" value={listing.id} />
                            <input type="hidden" name="returnTo" value="/buyer" />
                            <button className="h-11 w-full rounded-full border border-stone-400 bg-stone-200 px-2 text-center text-[13px] font-semibold leading-tight text-stone-900">
                              Add to Cart
                            </button>
                          </form>
                          <form action={buyNowAction}>
                            <input type="hidden" name="listingId" value={listing.id} />
                            <button className="h-11 w-full rounded-full bg-[var(--accent)] px-2 text-center text-[13px] font-semibold leading-tight text-white">
                              Purchase
                            </button>
                          </form>
                          {listing.allowOffers ? (
                            <Link href={`/listings/${listing.id}?intent=offer`} className="inline-flex h-11 w-full items-center justify-center rounded-full border border-amber-300 bg-amber-100 px-2 text-center text-[13px] font-semibold leading-tight text-amber-900">
                              Make Offer
                            </Link>
                          ) : (
                            <div />
                          )}
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-[1.5rem] border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-600 md:col-span-2">
                      No listings from saved users yet.
                    </div>
                  )}
                </div>
              </div>
            </article>

            <article className="panel rounded-[1.75rem] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow text-xs text-stone-500">Saved</p>
                  <h2 className="mt-3 text-2xl font-semibold text-stone-950">
                    <Link href="/buyer/saved-searches" className="transition hover:text-[var(--accent)]">
                      Saved Searches
                    </Link>
                  </h2>
                </div>
              </div>
              <div className="mt-5 grid gap-2">
                {savedSearches.length ? (
                  savedSearches.map((savedSearch) => (
                    <div key={savedSearch.id} className="rounded-[1rem] border border-stone-200 bg-white px-3 py-3">
                      {editingSavedSearchId === savedSearch.id ? (
                        <form action={renameSavedSearchAction} className="flex items-center justify-between gap-3">
                          <input type="hidden" name="savedSearchId" value={savedSearch.id} />
                          <input type="hidden" name="returnTo" value="/buyer" />
                          <input
                            name="name"
                            defaultValue={savedSearch.name}
                            maxLength={60}
                            className="min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-900 outline-none transition focus:border-stone-950"
                            aria-label={`Rename ${savedSearch.name}`}
                          />
                          <div className="flex items-center gap-2">
                            <button className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950">
                              Save
                            </button>
                            <Link
                              href="/buyer"
                              className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                            >
                              Cancel
                            </Link>
                          </div>
                        </form>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <Link
                              href={savedSearchHref(savedSearch)}
                              className="block truncate text-sm font-semibold text-stone-900 transition hover:text-[var(--accent)]"
                            >
                              {savedSearch.name}
                            </Link>
                            <p className="mt-1 text-xs text-stone-500">
                              {savedSearchCounts.get(savedSearch.id) ?? 0} items
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/buyer?renameSearch=${savedSearch.id}`}
                              className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                            >
                              Rename
                            </Link>
                            <form action={deleteSavedSearchAction}>
                              <input type="hidden" name="savedSearchId" value={savedSearch.id} />
                              <input type="hidden" name="returnTo" value="/buyer" />
                              <ConfirmDeleteButton
                                message={`Delete saved search "${savedSearch.name}"?`}
                                className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                              >
                                Delete
                              </ConfirmDeleteButton>
                            </form>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-600">
                    No saved searches yet.
                  </div>
                )}
              </div>
            </article>
          </div>
        </section>
      </PageWrap>
    </AppShell>
  );
}
