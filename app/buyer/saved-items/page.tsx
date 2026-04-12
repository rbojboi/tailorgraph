import { redirect } from "next/navigation";
import { AppShell, PageWrap } from "@/components/ui";
import { BuyerListingCard } from "@/components/buyer-listing-card";
import { BuyerSubpageHeader } from "@/components/buyer-subpage-header";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeedData, listSavedListingsForUser } from "@/lib/store";

export default async function BuyerSavedItemsPage() {
  await ensureSeedData();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/?authError=Please+log+in+to+access+the+buyer+dashboard");
  }

  const savedListings = await listSavedListingsForUser(user.id);
  const savedListingIds = new Set(savedListings.map((listing) => listing.id));

  return (
    <AppShell>
      <PageWrap>
        <BuyerSubpageHeader
          eyebrow="Buyer Dashboard"
          title="Saved Items"
          description="Browse the items you've saved in one place."
        />

        <section className="panel rounded-[1.75rem] p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {savedListings.length ? (
              savedListings.map((listing) => (
                <BuyerListingCard
                  key={listing.id}
                  listing={listing}
                  returnTo="/buyer/saved-items"
                  isSaved={savedListingIds.has(listing.id)}
                />
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-stone-300 px-4 py-10 text-center text-sm text-stone-600 md:col-span-2 xl:col-span-3">
                No saved items yet.
              </div>
            )}
          </div>
        </section>
      </PageWrap>
    </AppShell>
  );
}
