import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, PageWrap } from "@/components/ui";
import { BuyerListingCard } from "@/components/buyer-listing-card";
import { BuyerSubpageHeader } from "@/components/buyer-subpage-header";
import { getCurrentUser } from "@/lib/auth";
import {
  ensureSeedData,
  listActiveListingsBySellerId,
  listListingsFromFollowedUsers,
  listSavedListingsForUser,
  listSavedUsersForUser
} from "@/lib/store";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BuyerSavedUsersPage({
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

  const [savedUsers, savedListings, allSavedUserListings] = await Promise.all([
    listSavedUsersForUser(user.id),
    listSavedListingsForUser(user.id),
    listListingsFromFollowedUsers(user.id, 120)
  ]);

  const selectedUsername = firstValue(params.user) || "";
  const selectedUser = savedUsers.find((savedUser) => savedUser.username === selectedUsername) ?? null;
  const selectedListings = selectedUser
    ? await listActiveListingsBySellerId(selectedUser.id)
    : allSavedUserListings;
  const savedListingIds = new Set(savedListings.map((listing) => listing.id));
  const activeCounts = new Map<string, number>();

  for (const listing of allSavedUserListings) {
    activeCounts.set(listing.sellerId, (activeCounts.get(listing.sellerId) ?? 0) + 1);
  }

  return (
    <AppShell>
      <PageWrap>
        <BuyerSubpageHeader
          eyebrow="Buyer Dashboard"
          title="Saved Users"
          description="Keep track of the sellers you've saved and browse their active items."
        />

        <section className="grid gap-6 xl:grid-cols-[18rem_1fr]">
          <aside className="panel h-fit rounded-[1.75rem] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow text-xs text-stone-500">Saved</p>
                <h2 className="mt-3 text-2xl font-semibold text-stone-950">Users</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <Link
                href="/buyer/saved-users"
                className={`rounded-[1.25rem] border px-4 py-4 text-sm transition ${
                  !selectedUser
                    ? "border-stone-950 bg-stone-950 text-white"
                    : "border-stone-300 bg-white text-stone-900 hover:border-stone-950"
                }`}
              >
                <p className="font-semibold">All Saved Users</p>
                <p className={`mt-1 text-xs ${!selectedUser ? "text-stone-200" : "text-stone-500"}`}>
                  {savedUsers.length} users
                </p>
              </Link>

              {savedUsers.length ? (
                savedUsers.map((savedUser) => {
                  const isSelected = selectedUser?.id === savedUser.id;
                  return (
                    <Link
                      key={savedUser.id}
                      href={`/buyer/saved-users?user=${savedUser.username}`}
                      className={`rounded-[1.25rem] border px-4 py-4 text-sm transition ${
                        isSelected
                          ? "border-stone-950 bg-stone-950 text-white"
                          : "border-stone-300 bg-white text-stone-900 hover:border-stone-950"
                      }`}
                    >
                      <p className="font-semibold">@{savedUser.username}</p>
                      <p className={`mt-1 text-xs ${isSelected ? "text-stone-200" : "text-stone-500"}`}>
                        {activeCounts.get(savedUser.id) ?? 0} active items
                      </p>
                    </Link>
                  );
                })
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-600">
                  No saved users yet.
                </div>
              )}
            </div>
          </aside>

          <section className="panel rounded-[1.75rem] p-6">
            <div>
              <p className="eyebrow text-xs text-stone-500">Feed</p>
              <h2 className="mt-3 text-2xl font-semibold text-stone-950">
                {selectedUser ? `Items from @${selectedUser.username}` : "Combined Items from Saved Users"}
              </h2>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {selectedListings.length ? (
                selectedListings.map((listing) => (
                  <BuyerListingCard
                    key={listing.id}
                    listing={listing}
                    returnTo={selectedUser ? `/buyer/saved-users?user=${selectedUser.username}` : "/buyer/saved-users"}
                    isSaved={savedListingIds.has(listing.id)}
                  />
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-stone-300 px-4 py-10 text-center text-sm text-stone-600 md:col-span-2 xl:col-span-3">
                  {selectedUser ? `@${selectedUser.username} does not have active items right now.` : "No listings from saved users yet."}
                </div>
              )}
            </div>
          </section>
        </section>
      </PageWrap>
    </AppShell>
  );
}
