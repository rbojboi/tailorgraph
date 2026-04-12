import Link from "next/link";
import { redirect } from "next/navigation";
import { createListingAction, forceCreateListingAction } from "@/app/actions";
import { SellerListingForm } from "@/components/seller-listing-form";
import { AppShell, PageWrap, SectionTitle } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import type { BuyerBodyMeasurementSanityCheckResult } from "@/lib/measurement-guide-support";
import { ensureSeedData } from "@/lib/store";

type PageProps = {
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

export default async function NewSellerListingPage({ searchParams }: PageProps) {
  const filters = await searchParams;
  await ensureSeedData();
  const user = await getCurrentUser();

  if (!user || (user.role !== "seller" && user.role !== "both")) {
    redirect("/?authError=Seller+account+required");
  }

  const measurementWarnings = parseMeasurementWarnings(filters.measurementWarnings);
  const sellerListingDraft = firstValue(filters.sellerListingDraft) ?? "";
  const sellerListingMedia = firstValue(filters.sellerListingMedia) ?? "";

  return (
    <AppShell>
      <PageWrap>
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="eyebrow text-xs text-stone-500">New Listing</p>
              <h1 className="mt-3 text-4xl font-semibold text-stone-950">Create a New Listing</h1>
            </div>
            <Link
              href="/seller"
              className="shrink-0 self-start rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800"
            >
              Back to Seller Dashboard
            </Link>
          </div>
          {firstValue(filters.authError) ? (
            <p className="mt-4 rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">{firstValue(filters.authError)}</p>
          ) : null}
        </section>

        <section className="panel rounded-[1.75rem] p-6">
          <SectionTitle
            eyebrow="Create"
            title="Listing Details"
            description="Create a structured listing here, then publish it when everything looks right."
          />
          <SellerListingForm
            action={createListingAction}
            sanityCheck={measurementWarnings}
            warningDraft={sellerListingDraft}
            warningMedia={sellerListingMedia}
            warningAction={forceCreateListingAction}
            warningButtonLabel="Publish Anyway"
          />
        </section>
      </PageWrap>
    </AppShell>
  );
}
