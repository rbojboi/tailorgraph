import Link from "next/link";
import { redirect } from "next/navigation";
import { emailBuyerReturnLabelAction, openIssueAction } from "@/app/actions";
import { BuyerPurchaseActionsMenu } from "@/components/buyer-purchase-actions-menu";
import { BuyerPurchaseFilterControl } from "@/components/buyer-purchase-filter-control";
import { BuyerSubpageHeader } from "@/components/buyer-subpage-header";
import { OrderRatingStars } from "@/components/order-rating-stars";
import { AppShell, PageWrap, Spec } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatDisplayValue } from "@/lib/display";
import { isShippoConfigured } from "@/lib/shippo";
import { ensureSeedData, listBuyerOrders } from "@/lib/store";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type BuyerPurchaseFilter = "all" | "return_eligible" | "shipped" | "delivered" | "canceled";
type BuyerReturnStatus = "requested" | "approved" | "label_created" | "in_transit" | "received" | "closed" | null;

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

function getBuyerPurchaseStatus(order: { status: string; returnsAccepted: boolean; deliveredAt: string | null; returnStatus?: BuyerReturnStatus }) {
  if (["canceled", "refunded", "failed"].includes(order.status)) {
    return "Canceled";
  }

  if (order.returnStatus === "received") {
    return "Return Received";
  }

  if (order.returnStatus === "in_transit") {
    return "Return In Transit";
  }

  if (order.returnStatus === "label_created") {
    return "Return Label Created";
  }

  if (order.returnStatus === "approved") {
    return "Return Approved";
  }

  if (order.returnStatus === "requested") {
    return "Return Requested";
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

function getBuyerDeliveryLabel(order: {
  status: string;
  createdAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  shippingEta: string | null;
}) {
  if (order.status === "delivered" && order.deliveredAt) {
    return formatLongDate(order.deliveredAt);
  }

  if (order.shippingEta) {
    return formatLongDate(order.shippingEta);
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

function canReturnOrder(order: {
  status: string;
  returnsAccepted: boolean;
  deliveredAt: string | null;
  returnStatus?: BuyerReturnStatus;
}) {
  if (order.returnStatus) {
    return false;
  }

  return getBuyerPurchaseStatus(order) === "Return Eligible";
}

function canCancelOrder(order: { status: string }) {
  return ["pending_payment", "paid", "processing"].includes(order.status);
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

function filterBuyerOrders<T extends { status: string; returnsAccepted: boolean; deliveredAt: string | null; returnStatus?: BuyerReturnStatus }>(orders: T[], filter: BuyerPurchaseFilter) {
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

export default async function BuyerOrdersPage({
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

  const requestedPurchaseStatus = firstValue(params.purchaseStatus) as BuyerPurchaseFilter | undefined;
  const selectedPurchaseStatus: BuyerPurchaseFilter =
    requestedPurchaseStatus && ["all", "return_eligible", "shipped", "delivered", "canceled"].includes(requestedPurchaseStatus)
      ? requestedPurchaseStatus
      : "all";
  const saved = firstValue(params.saved);
  const authError = firstValue(params.authError);
  const ratedOrder = firstValue(params.ratedOrder);
  const shippoEnabled = isShippoConfigured();
  const orders = await listBuyerOrders(user.id);
  const filteredOrders = filterBuyerOrders(orders, selectedPurchaseStatus);

  return (
    <AppShell>
      <PageWrap>
        <BuyerSubpageHeader
          eyebrow="Buyer Dashboard"
          title="My Purchases"
        />

        {saved === "rating" && ratedOrder ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-900">
            <span>Rating saved.</span>
            <Link href={`/buyer/orders/${ratedOrder}/rate`} className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-semibold text-emerald-900 transition hover:border-emerald-500">
              Add More Details
            </Link>
          </div>
        ) : null}
        {saved === "issue" ? (
          <div className="rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-950">
            Your request has been sent to the seller for review.
          </div>
        ) : null}
        {saved === "return-approved" ? (
          <div className="rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-900">
            Return approved. You can choose a return label when you are ready to ship the item back.
          </div>
        ) : null}
        {saved === "return-label" ? (
          <div className="rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-900">
            Return label and QR created.
          </div>
        ) : null}
        {saved === "return-label-email" ? (
          <div className="rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-900">
            Return Label & QR Sent to Email.
          </div>
        ) : null}
        {authError ? (
          <div className="rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">
            {authError}
          </div>
        ) : null}

        <section className="panel overflow-visible rounded-[1.75rem] p-6">
          <div className="mb-5 flex justify-end">
            <BuyerPurchaseFilterControl currentFilter={selectedPurchaseStatus} />
          </div>
          <div className="grid gap-3">
            {filteredOrders.length ? (
              filteredOrders.map((order) => (
                <article key={order.id} className="relative overflow-visible rounded-[1.5rem] border border-stone-300 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 pr-28">
                    <div>
                      <Link href={`/listings/${order.listingId}`} className="text-sm font-semibold text-stone-950 transition hover:text-[var(--accent)]">
                        {order.listingTitle}
                      </Link>
                      <p className="mt-1 text-sm text-stone-700">
                        Paid ${order.subtotal.toFixed(2)}{order.shippingAmount > 0 ? ` (+ $${order.shippingAmount.toFixed(2)} shipping)` : ""} -{" "}
                        <Link href={`/users/${order.sellerName}`} className="font-semibold transition hover:text-[var(--accent)]">
                          @{order.sellerName}
                        </Link>
                      </p>
                    </div>
                    <div className="absolute right-14 top-4">
                      <OrderRatingStars
                        orderId={order.id}
                        currentRating={order.reviewOverallRating}
                        returnTo={`/buyer/orders?purchaseStatus=${selectedPurchaseStatus}`}
                      />
                    </div>
                  </div>
                  <div className="absolute right-4 top-4">
                    <BuyerPurchaseActionsMenu
                      listingId={order.listingId}
                      orderId={order.id}
                      canRate={canRateOrder(order)}
                      canConfirmDelivery={order.status === "shipped" || order.status === "processing"}
                      canCancel={canCancelOrder(order)}
                      canReturn={canReturnOrder(order)}
                      canReportIssue={canReportIssue(order)}
                      returnTo={`/buyer/orders?purchaseStatus=${selectedPurchaseStatus}&saved=issue`}
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
                            const trackingUrl =
                              order.trackingUrl || (order.trackingNumber ? getTrackingUrl(order.carrier, order.trackingNumber) : null);
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
                    {order.trackingStatus ? <Spec label="Tracking Status" value={formatDisplayValue(order.trackingStatus)} /> : null}
                  </div>
                  {order.returnStatus ? (
                    <div className="mt-4 rounded-[1.25rem] border border-amber-300 bg-amber-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-amber-950">
                            {order.returnStatus === "label_created"
                              ? "Return label ready"
                              : order.returnStatus === "in_transit"
                                ? "Return in transit"
                                : order.returnStatus === "received"
                                  ? "Return received"
                              : order.returnStatus === "approved"
                                ? "Return approved"
                                : "Return requested"}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-amber-900">
                            {order.returnStatus === "label_created"
                              ? "Use the return label or carrier QR to send the item back."
                              : order.returnStatus === "in_transit"
                                ? "The return package is on its way back to the seller."
                                : order.returnStatus === "received"
                                  ? "The seller has received the return package. Refund or dispute review is the next step."
                              : order.returnStatus === "approved"
                                ? "Create the return label when you are ready to ship the item back."
                                : "The seller needs to confirm the return before a label can be created."}
                          </p>
                          <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-amber-950">
                            Return requested by you. We will keep this return open while the item is on its way back
                            to the seller.
                          </p>
                        </div>
                        {order.returnStatus === "approved" && !order.returnLabelUrl && !order.returnQrCodeUrl && shippoEnabled ? (
                          <Link
                            href={`/buyer/orders/${order.id}/return/shippo`}
                            className="rounded-full bg-amber-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-950"
                          >
                            Choose Return Label
                          </Link>
                        ) : null}
                      </div>
                      {order.returnStatus === "approved" && !shippoEnabled ? (
                        <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-amber-950">
                          Return labels are not configured yet.
                        </p>
                      ) : null}
                      {order.returnLabelUrl || order.returnQrCodeUrl ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {order.returnLabelUrl ? (
                            <a
                              href={order.returnLabelUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="shipment-action-button shipment-action-button--amber"
                            >
                              Open Return Label PDF
                            </a>
                          ) : null}
                          {order.returnQrCodeUrl ? (
                            <a
                              href={order.returnQrCodeUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="shipment-action-button shipment-action-button--amber"
                            >
                              Open Return Carrier QR
                            </a>
                          ) : null}
                          <form action={emailBuyerReturnLabelAction} className="contents">
                            <input type="hidden" name="orderId" value={order.id} />
                            <input type="hidden" name="returnTo" value="/buyer/orders" />
                            <button className="shipment-action-button shipment-action-button--amber">
                              {order.returnQrCodeUrl ? "Email Label & QR" : "Email Label"}
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {canCancelOrder(order) || canReturnOrder(order) ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {canCancelOrder(order) ? (
                        <form action={openIssueAction}>
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="issueReason" value="Cancellation requested by buyer" />
                          <input type="hidden" name="returnTo" value={`/buyer/orders?purchaseStatus=${selectedPurchaseStatus}&saved=issue`} />
                          <button className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950">
                            Request Cancellation
                          </button>
                        </form>
                      ) : null}
                      {canReturnOrder(order) ? (
                        <form action={openIssueAction}>
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="issueReason" value="Return requested by buyer" />
                          <input type="hidden" name="returnTo" value={`/buyer/orders?purchaseStatus=${selectedPurchaseStatus}&saved=issue`} />
                          <button className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950">
                            Request Return
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-stone-300 px-4 py-10 text-center text-sm text-stone-600">
                No {selectedPurchaseStatus === "all" ? "" : `${getPurchaseFilterLabel(selectedPurchaseStatus)} `}purchases yet.
              </div>
            )}
          </div>
        </section>
      </PageWrap>
    </AppShell>
  );
}
