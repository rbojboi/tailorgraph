import Link from "next/link";
import { redirect } from "next/navigation";
import { BuyerOfferActionsMenu } from "@/components/buyer-offer-actions-menu";
import { BuyerOfferFilterControl } from "@/components/buyer-offer-filter-control";
import { BuyerSubpageHeader } from "@/components/buyer-subpage-header";
import { AppShell, PageWrap, Spec } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/display";
import { ensureSeedData, listBuyerOffers } from "@/lib/store";
import type { OfferStatus } from "@/lib/types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type BuyerOfferFilter = OfferStatus | "all";

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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

export default async function BuyerOffersPage({
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
  const offers = await listBuyerOffers(user.id, selectedOfferStatus);

  return (
    <AppShell>
      <PageWrap>
        <BuyerSubpageHeader
          eyebrow="Buyer Dashboard"
          title="My Offers"
          description="Review the offers you've made across the marketplace."
        />

        <section className="panel rounded-[1.75rem] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="eyebrow text-xs text-stone-500">Offers</p>
              <h2 className="mt-3 text-2xl font-semibold text-stone-950">My Offers</h2>
            </div>
            <div className="mt-7">
              <BuyerOfferFilterControl currentFilter={selectedOfferStatus} />
            </div>
          </div>
          <div className="mt-5 grid gap-3">
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
              <div className="rounded-[1.5rem] border border-dashed border-stone-300 px-4 py-10 text-center text-sm text-stone-600">
                No {selectedOfferStatus === "all" ? "" : `${selectedOfferStatus} `}offers yet.
              </div>
            )}
          </div>
        </section>
      </PageWrap>
    </AppShell>
  );
}
