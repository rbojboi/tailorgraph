import Link from "next/link";
import { redirect } from "next/navigation";
import { filterAndSortMarketplaceListings } from "@/app/marketplace/page";
import { deleteSavedSearchAction, renameSavedSearchAction } from "@/app/actions";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { BuyerSubpageHeader } from "@/components/buyer-subpage-header";
import { AppShell, PageWrap } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeedData, listMarketplace, listSavedSearchesForUser } from "@/lib/store";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function savedSearchHref(savedSearch: { id: string; queryString: string }) {
  return savedSearch.queryString ? `/?savedSearchId=${savedSearch.id}&${savedSearch.queryString}` : `/?savedSearchId=${savedSearch.id}`;
}

function savedSearchFilters(queryString: string) {
  const params = new URLSearchParams(queryString);
  const filters: Record<string, string | string[]> = {};

  for (const [key, value] of params.entries()) {
    const existing = filters[key];
    if (existing === undefined) {
      filters[key] = value;
    } else {
      filters[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    }
  }

  return filters;
}

export default async function BuyerSavedSearchesPage({
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

  const [savedSearches, marketplace] = await Promise.all([
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

  return (
    <AppShell>
      <PageWrap>
        <BuyerSubpageHeader
          eyebrow="Buyer Dashboard"
          title="Saved Searches"
          description="Open, rename, and manage the searches you've saved from the marketplace."
        />

        <section className="panel rounded-[1.75rem] p-6">
          <div className="grid gap-3">
            {savedSearches.length ? (
              savedSearches.map((savedSearch) => (
                <div key={savedSearch.id} className="rounded-[1rem] border border-stone-200 bg-white px-3 py-3">
                  {editingSavedSearchId === savedSearch.id ? (
                    <form action={renameSavedSearchAction} className="flex items-center justify-between gap-3">
                      <input type="hidden" name="savedSearchId" value={savedSearch.id} />
                      <input type="hidden" name="returnTo" value="/buyer/saved-searches" />
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
                          href="/buyer/saved-searches"
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
                          href={`/buyer/saved-searches?renameSearch=${savedSearch.id}`}
                          className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                        >
                          Rename
                        </Link>
                        <form action={deleteSavedSearchAction}>
                          <input type="hidden" name="savedSearchId" value={savedSearch.id} />
                          <input type="hidden" name="returnTo" value="/buyer/saved-searches" />
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
              <div className="rounded-[1.5rem] border border-dashed border-stone-300 px-4 py-10 text-center text-sm text-stone-600">
                No saved searches yet.
              </div>
            )}
          </div>
        </section>
      </PageWrap>
    </AppShell>
  );
}
