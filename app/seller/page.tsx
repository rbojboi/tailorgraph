import Link from "next/link";
import { redirect } from "next/navigation";
import Stripe from "stripe";
import { createStripeConnectOnboardingAction } from "@/app/actions";
import { BuyerOfferFilterControl } from "@/components/buyer-offer-filter-control";
import { AppShell, PageWrap, SectionTitle, Spec } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/display";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { ensureSeedData, listSellerInventory, listSellerOffers, listSellerOrders } from "@/lib/store";
import type { OfferStatus, Order } from "@/lib/types";

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

function getSellerDeliveryLabel(order: { status: string; createdAt: string; shippedAt: string | null; deliveredAt: string | null }) {
  if (order.status === "delivered" && order.deliveredAt) {
    return formatLongDate(order.deliveredAt);
  }

  const deliveryBase = order.shippedAt ?? order.createdAt;
  return `Expected ${formatShortDate(addBusinessDays(new Date(deliveryBase), 5).toISOString())}`;
}

function getSellerSaleStatus(order: Order) {
  if (["canceled", "refunded", "failed"].includes(order.status)) {
    return "Canceled";
  }

  if (order.status === "shipped" || order.status === "issue_open") {
    return "Shipped";
  }

  if (order.status === "delivered") {
    return "Completed";
  }

  return "Sold";
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

export default async function SellerPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  await ensureSeedData();
  const user = await getCurrentUser();

  if (!user || (user.role !== "seller" && user.role !== "both")) {
    redirect("/?authError=Seller+account+required+to+access+the+seller+dashboard");
  }

  const requestedOfferStatus = firstValue(params.offerStatus) as OfferStatus | "all" | undefined;
  const selectedOfferStatus: OfferStatus | "all" =
    requestedOfferStatus && ["all", "active", "accepted", "rejected"].includes(requestedOfferStatus)
      ? requestedOfferStatus
      : "all";
  const stripeEnabled = isStripeConfigured();
  let stripeAccount: Stripe.Account | null = null;

  if (stripeEnabled && user.stripeAccountId) {
    try {
      stripeAccount = await getStripe().accounts.retrieve(user.stripeAccountId);
    } catch {
      stripeAccount = null;
    }
  }

  const [sales, offers, inventory] = await Promise.all([
    listSellerOrders(user.id),
    listSellerOffers(user.id, selectedOfferStatus),
    listSellerInventory(user.id)
  ]);
  const currentlyDue = stripeAccount?.requirements?.currently_due ?? [];
  const eventuallyDue = stripeAccount?.requirements?.eventually_due ?? [];
  const activeCount = inventory.filter((listing) => listing.status === "active").length;
  const draftCount = inventory.filter((listing) => listing.status === "draft").length;
  const archivedCount = inventory.filter((listing) => listing.status === "archived").length;

  return (
    <AppShell>
      <PageWrap>
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="eyebrow text-xs text-stone-500">Seller Dashboard</p>
              <h1 className="mt-3 text-4xl font-semibold text-stone-950">{user.name}</h1>
              <p className="mt-3 text-sm text-stone-700">{user.sellerLocation || "Location Not Yet Added"}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/seller/listings/new"
                  className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
                >
                  Create New Listing
                </Link>
                <Link
                  href="/seller/listings"
                  className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 transition hover:border-stone-950"
                >
                  Manage Listings
                </Link>
              </div>
            </div>
          </div>
          {firstValue(params.authError) ? (
            <p className="mt-4 rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">
              {firstValue(params.authError)}
            </p>
          ) : null}
          {firstValue(params.saved) ? (
            <p className="mt-4 rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-900">
              Saved {firstValue(params.saved)}.
            </p>
          ) : null}
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <article className="panel rounded-[1.75rem] p-6">
            <div>
              <p className="eyebrow text-xs text-stone-500">Items</p>
              <h2 className="mt-3 text-2xl font-semibold text-stone-950">
                <Link href="/seller/listings" className="transition hover:text-[var(--accent)]">
                  My Listings
                </Link>
              </h2>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Spec label="Active" value={String(activeCount)} />
              <Spec label="Drafts" value={String(draftCount)} />
              <Spec label="Archived" value={String(archivedCount)} />
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Link
                href="/seller/listings/new"
                className="rounded-[1.5rem] border border-stone-300 bg-white p-5 transition hover:border-stone-950"
              >
                <p className="text-sm font-semibold text-stone-950">Create New Listing</p>
                <p className="mt-2 text-sm text-stone-700">
                  Start a fresh draft, upload media, and publish when the item is ready.
                </p>
              </Link>
              <Link
                href="/seller/listings"
                className="rounded-[1.5rem] border border-stone-300 bg-white p-5 transition hover:border-stone-950"
              >
                <p className="text-sm font-semibold text-stone-950">Manage Listings</p>
                <p className="mt-2 text-sm text-stone-700">
                  Work through active, draft, sold, shipped, completed, and archived items in one place.
                </p>
              </Link>
            </div>
          </article>

          <article className="panel rounded-[1.75rem] p-6">
            <div>
              <p className="eyebrow text-xs text-stone-500">Sales</p>
              <h2 className="mt-3 text-2xl font-semibold text-stone-950">My Sales</h2>
            </div>
            <div className="mt-5 max-h-[33rem] overflow-y-auto pr-2">
              <div className="grid gap-3">
                {sales.length ? (
                  sales.map((order) => (
                    <article key={order.id} className="rounded-[1.5rem] border border-stone-300 bg-white p-4">
                      <div>
                        <Link href={`/listings/${order.listingId}`} className="text-sm font-semibold text-stone-950 transition hover:text-[var(--accent)]">
                          {order.listingTitle}
                        </Link>
                        <p className="mt-1 text-sm text-stone-700">
                          Sold {formatCurrency(order.subtotal)}
                          {order.shippingAmount > 0 ? ` (+ ${formatCurrency(order.shippingAmount)} shipping)` : ""} to{" "}
                          <span className="font-semibold text-stone-900">{order.buyerName}</span>
                        </p>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <Spec label="Status" value={getSellerSaleStatus(order)} />
                        <Spec label="Delivery" value={getSellerDeliveryLabel(order)} />
                        <Spec label="Carrier" value={order.carrier || "Pending"} />
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-600">
                    No sales yet.
                  </div>
                )}
              </div>
            </div>
          </article>

          <article className="panel rounded-[1.75rem] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="eyebrow text-xs text-stone-500">Offers</p>
                <h2 className="mt-3 text-2xl font-semibold text-stone-950">My Offers</h2>
              </div>
              <div className="mt-7 flex items-center gap-3">
                <BuyerOfferFilterControl currentFilter={selectedOfferStatus} />
              </div>
            </div>
            <div className="mt-5 max-h-[33rem] overflow-y-auto pr-2">
              <div className="grid gap-3">
                {offers.length ? (
                  offers.map((offer) => (
                    <article key={offer.id} className="rounded-[1.5rem] border border-stone-300 bg-white p-4">
                      <div>
                        <Link href={`/listings/${offer.listingId}`} className="text-sm font-semibold text-stone-950 transition hover:text-[var(--accent)]">
                          {offer.listingTitle}
                        </Link>
                        <p className="mt-1 text-sm text-stone-700">
                          Offer of {formatCurrency(offer.amount)} from{" "}
                          <Link href={`/users/${offer.buyerUsername}`} className="font-semibold transition hover:text-[var(--accent)]">
                            @{offer.buyerUsername}
                          </Link>
                        </p>
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
            <SectionTitle
              eyebrow="Discounts"
              title="Discounts"
              description="Seller-initiated offers for buyers who saved your listings will live here."
            />
            <div className="mt-5 rounded-[1.5rem] border border-dashed border-stone-300 bg-white px-4 py-10 text-center text-sm text-stone-600">
              Discounts are not live yet, but this is where seller-created discounts will appear once that feature is built.
            </div>
          </article>

          <article className="panel rounded-[1.75rem] p-6 xl:col-span-2">
            <SectionTitle
              eyebrow="Payouts"
              title="Stripe Connect and KYC"
              description="See connected account state, onboarding progress, and payout readiness in one place."
            />
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Spec label="Stripe configured" value={stripeEnabled ? "Yes" : "No"} />
              <Spec label="Connected account" value={user.stripeAccountId || "Not connected"} />
              <Spec label="Onboarding complete" value={user.stripeOnboardingComplete ? "Yes" : "No"} />
              <Spec label="Charges enabled" value={stripeAccount?.charges_enabled ? "Yes" : "No"} />
              <Spec label="Payouts enabled" value={stripeAccount?.payouts_enabled ? "Yes" : "No"} />
              <Spec label="Details submitted" value={stripeAccount?.details_submitted ? "Yes" : "No"} />
            </div>

            <div className="mt-5 rounded-[1.5rem] bg-white p-4">
              <p className="text-sm font-semibold text-stone-950">KYC items currently due</p>
              <p className="mt-2 text-sm text-stone-700">
                {currentlyDue.length ? currentlyDue.join(", ") : "No immediate KYC requirements returned by Stripe."}
              </p>
            </div>

            <div className="mt-4 rounded-[1.5rem] bg-white p-4">
              <p className="text-sm font-semibold text-stone-950">Eventually due</p>
              <p className="mt-2 text-sm text-stone-700">
                {eventuallyDue.length ? eventuallyDue.join(", ") : "No future requirements returned by Stripe."}
              </p>
            </div>

            {stripeEnabled ? (
              <form action={createStripeConnectOnboardingAction} className="mt-5">
                <button className="rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white">
                  {user.stripeAccountId ? "Open Connect onboarding" : "Start Connect onboarding"}
                </button>
              </form>
            ) : (
              <p className="mt-5 rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
                Add Stripe environment variables to enable onboarding and payout status.
              </p>
            )}
          </article>
        </section>
      </PageWrap>
    </AppShell>
  );
}
