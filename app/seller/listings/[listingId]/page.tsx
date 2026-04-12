import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, PageWrap, SectionTitle, Spec } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatDisplayValue, formatEraLabel } from "@/lib/display";
import { ensureSeedData, findListingById } from "@/lib/store";

type PageProps = {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SellerListingPage({ params, searchParams }: PageProps) {
  const { listingId } = await params;
  const filters = await searchParams;
  await ensureSeedData();
  const user = await getCurrentUser();

  if (!user || (user.role !== "seller" && user.role !== "both")) {
    redirect("/?authError=Seller+account+required");
  }

  const listing = await findListingById(listingId);
  if (!listing || listing.sellerId !== user.id) {
    redirect("/seller?authError=Listing+not+found");
  }

  return (
    <AppShell>
      <PageWrap>
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow text-xs text-stone-500">Seller Listing</p>
              <h1 className="mt-3 text-4xl font-semibold text-stone-950">{listing.title}</h1>
              <p className="mt-3 text-sm text-stone-700">
                {listing.brand} · {formatDisplayValue(listing.category)} · {formatDisplayValue(listing.status)}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/seller" className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800">
                Back to Seller Dashboard
              </Link>
              <Link href={`/seller/listings/${listing.id}/edit`} className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
                Edit Listing
              </Link>
            </div>
          </div>
          {firstValue(filters.saved) ? (
            <p className="mt-4 rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-900">Saved {firstValue(filters.saved)}.</p>
          ) : null}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="panel rounded-[1.75rem] p-6">
            <SectionTitle
              eyebrow="Media"
              title="Buyer-facing listing view"
              description="This is the inventory detail page for the seller, with the listing’s full published information."
            />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {listing.media.length ? (
                listing.media.map((media, index) => (
                  <div key={`${media.url}-${index}`} className="overflow-hidden rounded-[1.5rem] bg-stone-100">
                    {media.kind === "video" ? (
                      <video src={media.url} controls className="h-72 w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={media.url} alt={media.originalName} className="h-72 w-full object-cover" />
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-stone-300 px-4 py-10 text-center text-sm text-stone-600">
                  No media uploaded for this listing.
                </div>
              )}
            </div>
          </article>

          <article className="panel rounded-[1.75rem] p-6">
            <SectionTitle
              eyebrow="Details"
              title="Listing information"
              description="Measurements, pricing, and published specifications for this item."
            />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Spec label="Price" value={`$${listing.price.toFixed(2)}`} />
              <Spec label="Estimated Shipping" value={`$${listing.shippingPrice.toFixed(2)}`} />
              <Spec label="Condition" value={formatDisplayValue(listing.condition)} />
              <Spec label="Era" value={formatEraLabel(listing.vintage)} />
              <Spec label="Country of Origin" value={formatDisplayValue(listing.countryOfOrigin)} />
              <Spec label="Fabric" value={formatDisplayValue(listing.material)} />
              <Spec label="Pattern" value={formatDisplayValue(listing.pattern)} />
              <Spec label="Returns Accepted" value={listing.returnsAccepted ? "Yes" : "No"} />
              <Spec label="Seller Location" value={listing.location} />
              <Spec label="Allow Offers" value={listing.allowOffers ? "Yes" : "No"} />
            </div>

            <div className="mt-6 rounded-[1.5rem] bg-white p-4">
              <p className="text-sm font-semibold text-stone-950">Description</p>
              <p className="mt-3 text-sm leading-6 text-stone-700">{listing.description || "No description added."}</p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Spec label="Chest" value={listing.chest ? `${listing.chest}"` : "N/A"} />
              <Spec label="Shoulder" value={listing.shoulder ? `${listing.shoulder}"` : "N/A"} />
              <Spec label="Waist" value={listing.waist ? `${listing.waist}"` : "N/A"} />
              <Spec label="Sleeve" value={listing.sleeve ? `${listing.sleeve}"` : "N/A"} />
              <Spec label="Inseam" value={listing.inseam ? `${listing.inseam}"` : "N/A"} />
              <Spec label="Outseam" value={listing.outseam ? `${listing.outseam}"` : "N/A"} />
            </div>
          </article>
        </section>
      </PageWrap>
    </AppShell>
  );
}
