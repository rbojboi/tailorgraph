import Link from "next/link";
import { addToCartAction, buyNowAction, toggleSaveListingAction } from "@/app/actions";
import { formatDisplayValue, formatSizeLabel } from "@/lib/display";
import type { Listing } from "@/lib/types";

export function BuyerListingCard({
  listing,
  returnTo,
  isSaved
}: {
  listing: Listing;
  returnTo: string;
  isSaved: boolean;
}) {
  return (
    <article className="panel relative flex h-full flex-col rounded-[1.75rem] p-4">
      <Link href={`/listings/${listing.id}`} className="absolute inset-0 rounded-[1.75rem]" aria-label={`View ${listing.title}`} />
      <div className="pointer-events-none relative z-10 overflow-hidden rounded-[1.25rem] bg-stone-100">
        <div className="aspect-[4/5] w-full">
          {listing.media[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.media[0].url} alt={listing.title} className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-stone-500">Media will appear here</div>
          )}
        </div>
        <div className="pointer-events-auto absolute right-3 top-3 z-20">
          <form action={toggleSaveListingAction}>
            <input type="hidden" name="listingId" value={listing.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <button
              className={`inline-flex min-h-[2.2rem] items-center justify-center rounded-full px-3 py-2 text-xs font-semibold transition ${
                isSaved
                  ? "border border-emerald-300 bg-emerald-100 text-emerald-900"
                  : "border border-stone-300 bg-white text-stone-700 hover:border-stone-950 hover:text-stone-950"
              }`}
            >
              {isSaved ? "Saved" : "Save Item"}
            </button>
          </form>
        </div>
      </div>

      <div className="pointer-events-none relative z-10 mt-4 flex flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-stone-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
            {formatDisplayValue(listing.category)}
          </span>
          <span className="rounded-full bg-[rgba(180,91,50,0.12)] px-3 py-1 text-[11px] font-medium tracking-[0.16em] text-[var(--accent-deep)]">
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
          <input type="hidden" name="returnTo" value={returnTo} />
          <button className="h-11 w-full rounded-full border border-stone-300 bg-white px-2 text-center text-[12px] font-semibold leading-none text-stone-800">
            Add to Cart
          </button>
        </form>
        <form action={buyNowAction}>
          <input type="hidden" name="listingId" value={listing.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button className="h-11 w-full rounded-full bg-[var(--accent)] px-2 text-center text-[13px] font-semibold leading-tight text-white">
            Purchase
          </button>
        </form>
        {listing.allowOffers ? (
          <Link href={`/listings/${listing.id}?intent=offer`} className="inline-flex h-11 w-full items-center justify-center rounded-full border border-amber-300 bg-amber-50 px-2 text-center text-[13px] font-semibold leading-tight text-amber-900">
            Make Offer
          </Link>
        ) : (
          <div />
        )}
      </div>
    </article>
  );
}
