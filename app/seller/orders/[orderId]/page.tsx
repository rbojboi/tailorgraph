import Link from "next/link";
import { redirect } from "next/navigation";
import {
  buyShippoLabelAction,
  emailSellerShipmentLabelAction,
  shipOrderAction
} from "@/app/actions";
import { AppShell, Input, PageWrap, SectionTitle, Spec } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency, formatDisplayValue } from "@/lib/display";
import { getSellerOrderStatusLabel } from "@/lib/order-status";
import { isShippoConfigured } from "@/lib/shippo";
import { ensureSeedData, findListingById, findOrderById } from "@/lib/store";
import type { Order } from "@/lib/types";

type PageParams = Promise<{ orderId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const shipmentMaterialButtonClass =
  "shipment-action-button shipment-action-button--stone";

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function sellerOrderSavedMessage(saved: string) {
  switch (saved) {
    case "shipment-email":
      return "Shipment Label & QR Sent to Email.";
    default:
      return `Saved ${saved}.`;
  }
}

function formatDateLabel(value: string | null) {
  if (!value) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function shippingAddressLines(order: Order) {
  return [
    order.shippingAddress.fullName,
    order.shippingAddress.line1,
    order.shippingAddress.line2,
    [order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.postalCode]
      .filter(Boolean)
      .join(", "),
    order.shippingAddress.country
  ].filter(Boolean);
}

export default async function SellerOrderFulfillmentPage({
  params,
  searchParams
}: {
  params: PageParams;
  searchParams: SearchParams;
}) {
  await ensureSeedData();
  const user = await getCurrentUser();

  if (!user || (user.role !== "seller" && user.role !== "both")) {
    redirect("/?authError=Seller+account+required");
  }

  const [{ orderId }, query] = await Promise.all([params, searchParams]);
  const order = await findOrderById(orderId);

  if (!order || order.sellerId !== user.id) {
    redirect("/seller?authError=Order+not+found");
  }

  const listing = await findListingById(order.listingId);
  const shippoEnabled = isShippoConfigured();
  const saved = firstValue(query.saved);
  const authError = firstValue(query.authError);
  const hasProviderLabel = Boolean(order.shippingLabelUrl || order.shippingQrCodeUrl);
  const canBuyLabel = !order.carrier && (order.status === "paid" || order.status === "processing");

  return (
    <AppShell>
      <PageWrap maxWidth="max-w-6xl">
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <SectionTitle
              eyebrow="Fulfillment"
              title="Seller Order Detail"
              description="Ship the order, open carrier materials, and keep tracking details in one place."
            />
            <Link
              href="/seller"
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 transition hover:border-stone-950"
            >
              Back to Seller
            </Link>
          </div>

          {authError ? (
            <p className="mt-4 rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">{authError}</p>
          ) : null}
          {saved ? (
            <p className="mt-4 rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-900">
              {sellerOrderSavedMessage(saved)}
            </p>
          ) : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Spec label="Status" value={getSellerOrderStatusLabel(order)} />
            <Spec label="Buyer" value={order.buyerName} />
            <Spec label="Order Total" value={formatCurrency(order.amount)} />
            <Spec label="Ordered" value={formatDateLabel(order.createdAt)} />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="panel rounded-[1.75rem] p-6">
            <SectionTitle
              eyebrow="Shipping"
              title={order.carrier ? "Shipping Details" : "Buy or Add Shipping"}
              description={
                order.carrier
                  ? "Open fulfillment materials and review carrier data without mixing the two."
                  : "Buy a Shippo label or enter tracking manually if you already shipped this order."
              }
            />

            {order.carrier ? (
              <div className="mt-5 grid gap-4">
                <div className="rounded-[1.5rem] border border-stone-300 bg-white p-5">
                  <p className="text-sm font-semibold text-stone-950">Shipment Materials</p>
                  <p className="mt-2 text-sm leading-6 text-stone-700">
                    Open the carrier documents the seller needs for package handoff.
                  </p>

                  {!hasProviderLabel ? (
                    <p className="mt-4 rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
                      No Shippo label materials are attached to this shipment yet.
                    </p>
                  ) : null}

                  {hasProviderLabel && !order.shippingQrCodeUrl ? (
                    <p className="mt-4 rounded-2xl bg-stone-100 px-4 py-3 text-sm text-stone-700">
                      Carrier QR was not returned for this label. Use the PDF label instead.
                    </p>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-2">
                    {order.shippingLabelUrl ? (
                      <a
                        href={order.shippingLabelUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={shipmentMaterialButtonClass}
                      >
                        Open Label PDF
                      </a>
                    ) : null}
                    {order.shippingQrCodeUrl ? (
                      <a
                        href={order.shippingQrCodeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={shipmentMaterialButtonClass}
                      >
                        Open Carrier QR
                      </a>
                    ) : hasProviderLabel ? (
                      <span className="rounded-full border border-stone-200 bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-600">
                        Carrier QR unavailable
                      </span>
                    ) : null}
                    {hasProviderLabel ? (
                      <form action={emailSellerShipmentLabelAction} className="contents">
                        <input type="hidden" name="orderId" value={order.id} />
                        <input type="hidden" name="returnTo" value={`/seller/orders/${order.id}`} />
                        <button
                          type="submit"
                          className={shipmentMaterialButtonClass}
                        >
                          {order.shippingQrCodeUrl ? "Email Label & QR" : "Email Label"}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-stone-300 bg-stone-50 p-5">
                  <p className="text-sm font-semibold text-stone-950">Shipping Data</p>
                  <p className="mt-2 text-sm leading-6 text-stone-700">
                    Carrier, tracking, and delivery status for this order.
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Spec label="Carrier" value={order.carrier} />
                    <div className="rounded-2xl bg-white px-3 py-3">
                      <p className="text-xs uppercase tracking-wide text-stone-500">Tracking</p>
                      {order.trackingNumber ? (
                        order.trackingUrl ? (
                          <a
                            href={order.trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 block text-sm font-semibold text-[var(--accent)] transition hover:text-stone-950"
                          >
                            {order.trackingNumber}
                          </a>
                        ) : (
                          <p className="mt-1 text-sm font-semibold text-stone-900">{order.trackingNumber}</p>
                        )
                      ) : (
                        <p className="mt-1 text-sm font-semibold text-stone-900">Pending</p>
                      )}
                    </div>
                    <Spec
                      label="Tracking Status"
                      value={order.trackingStatus ? formatDisplayValue(order.trackingStatus) : "Pending"}
                    />
                    <Spec label="ETA" value={formatDateLabel(order.shippingEta)} />
                    <Spec label="Shipped" value={formatDateLabel(order.shippedAt)} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 grid gap-4">
                {canBuyLabel && shippoEnabled ? (
                  <div className="rounded-[1.5rem] border border-stone-300 bg-white p-5">
                    <p className="text-sm font-semibold text-stone-950">Shippo label</p>
                    <p className="mt-2 text-sm leading-6 text-stone-700">
                      Compare available services or buy the cheapest returned label for this order.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/seller/orders/${order.id}/shippo`}
                        className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 transition hover:border-stone-950"
                      >
                        Compare Shippo Rates
                      </Link>
                      <form action={buyShippoLabelAction}>
                        <input type="hidden" name="orderId" value={order.id} />
                        <button className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
                          Buy Cheapest Label
                        </button>
                      </form>
                    </div>
                  </div>
                ) : null}

                {canBuyLabel && !shippoEnabled ? (
                  <p className="rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
                    Add `SHIPPO_API_TOKEN` to enable Shippo label buying.
                  </p>
                ) : null}

                <form action={shipOrderAction} className="rounded-[1.5rem] border border-stone-300 bg-white p-5">
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="returnTo" value={`/seller/orders/${order.id}`} />
                  <p className="text-sm font-semibold text-stone-950">Manual shipment</p>
                  <p className="mt-2 text-sm leading-6 text-stone-700">
                    Use this if you already purchased postage outside TailorGraph.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <Input name="carrier" label="Carrier" type="text" />
                    <Input name="trackingNumber" label="Tracking or pickup ref" type="text" />
                    <Input name="sellerNotes" label="Seller notes" defaultValue={order.sellerNotes || ""} type="text" />
                  </div>
                  <button className="mt-4 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 transition hover:border-stone-950">
                    Mark as Shipped Manually
                  </button>
                </form>
              </div>
            )}
          </article>

          <div className="grid gap-6">
            <article className="panel rounded-[1.75rem] p-6">
              <SectionTitle
                eyebrow="Ship To"
                title="Buyer Address"
                description="Use this address for package handoff and carrier label verification."
              />
              <div className="mt-5 rounded-[1.5rem] bg-white p-5 text-sm leading-7 text-stone-800">
                {shippingAddressLines(order).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </article>

            <article className="panel rounded-[1.75rem] p-6">
              <SectionTitle
                eyebrow="Order"
                title="Item Details"
                description="Quick reference for the item attached to this shipment."
              />
              <div className="mt-5 rounded-[1.5rem] border border-stone-300 bg-white p-4">
                <div className="flex gap-4">
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-[1rem] bg-stone-100">
                    {listing?.media[0]?.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={listing.media[0].url}
                        alt={order.listingTitle}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-stone-500">No Media</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={`/listings/${order.listingId}`}
                      className="text-base font-semibold text-stone-950 transition hover:text-[var(--accent)]"
                    >
                      {order.listingTitle}
                    </Link>
                    <p className="mt-2 text-sm text-stone-700">
                      Item {formatCurrency(order.subtotal)}
                      {order.shippingAmount > 0 ? ` + ${formatCurrency(order.shippingAmount)} shipping` : ""}
                    </p>
                    <p className="mt-1 text-sm text-stone-700">Payment: {formatDisplayValue(order.paymentMethod)}</p>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>
      </PageWrap>
    </AppShell>
  );
}
