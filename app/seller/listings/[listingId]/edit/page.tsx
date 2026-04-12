import Link from "next/link";
import { redirect } from "next/navigation";
import { forceUpdateListingAction, updateListingAction } from "@/app/actions";
import { SellerListingForm } from "@/components/seller-listing-form";
import { AppShell, PageWrap, SectionTitle } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import type { BuyerBodyMeasurementSanityCheckResult } from "@/lib/measurement-guide-support";
import { ensureSeedData, findListingById } from "@/lib/store";

type PageProps = {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseMeasurementWarnings(value: string | string[] | undefined): BuyerBodyMeasurementSanityCheckResult | null {
  const raw = firstValue(value);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(raw)) as BuyerBodyMeasurementSanityCheckResult;
  } catch {
    return null;
  }
}

export default async function EditSellerListingPage({ params, searchParams }: PageProps) {
  const { listingId } = await params;
  const filters = await searchParams;
  const measurementWarnings = parseMeasurementWarnings(filters.measurementWarnings);
  const sellerListingDraft = firstValue(filters.sellerListingDraft) ?? "";
  const sellerListingMedia = firstValue(filters.sellerListingMedia) ?? "";

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
              <p className="eyebrow text-xs text-stone-500">Edit Listing</p>
              <h1 className="mt-3 text-4xl font-semibold text-stone-950">{listing.title}</h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={`/seller/listings/${listing.id}`} className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800">
                Back to Listing
              </Link>
            </div>
          </div>
          {firstValue(filters.authError) ? (
            <p className="mt-4 rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">{firstValue(filters.authError)}</p>
          ) : null}
        </section>

        <section className="panel rounded-[1.75rem] p-6">
          <SectionTitle
            eyebrow="Update"
            title="Edit Listing Details"
            description="Adjust the listing information here. Existing media is preserved unless you upload replacement files."
          />
          <SellerListingForm
            action={updateListingAction}
            listing={listing}
            sanityCheck={measurementWarnings}
            warningDraft={sellerListingDraft}
            warningMedia={sellerListingMedia}
            warningAction={forceUpdateListingAction}
            warningButtonLabel="Save Changes Anyway"
            submitLabel="Save Changes"
            showDraftButton={false}
          />
        </section>
      </PageWrap>
    </AppShell>
  );
}
