import Link from "next/link";
import { AppShell, PageWrap, SectionTitle } from "@/components/ui";
import { ensureSeedData, listActiveListingsBySellerId, listUsers } from "@/lib/store";
import type { User } from "@/lib/types";

function formatMemberSince(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(new Date(value));
}

function getPublicDisplayName(user: User) {
  const names = [];

  if (user.showPersonalNameOnProfile) {
    names.push(user.name);
  }

  if (user.showBusinessNameOnProfile && user.businessName) {
    names.push(user.businessName);
  }

  return names.join(" / ");
}

function getPublicLocation(user: User) {
  if (user.publicLocationMode === "hidden") {
    return "";
  }

  const rawLocation = user.sellerLocation || user.buyerProfile.location;
  if (!rawLocation) {
    return "";
  }

  const [city = "", state = ""] = rawLocation.split(",").map((part) => part.trim());
  const country = "United States";

  if (user.publicLocationMode === "country") {
    return country;
  }

  if (user.publicLocationMode === "state_country") {
    return state ? `${state}, ${country}` : country;
  }

  return city && state ? `${city}, ${state}, ${country}` : rawLocation;
}

export default async function UsersDirectoryPage() {
  await ensureSeedData();
  const users = await listUsers();
  const usersWithCounts = await Promise.all(
    users.map(async (user) => ({
      user,
      activeListings: await listActiveListingsBySellerId(user.id)
    }))
  );

  return (
    <AppShell>
      <PageWrap maxWidth="max-w-6xl">
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <SectionTitle
            eyebrow="Profiles"
            title="User Profiles"
            description="Browse the current TailorGraph user pages, then we can go through and refine each profile’s presentation."
          />

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {usersWithCounts.map(({ user, activeListings }) => (
              <Link
                key={user.id}
                href={`/users/${user.username}`}
                className="rounded-[1.75rem] border border-stone-300 bg-white px-5 py-5 transition hover:-translate-y-0.5 hover:border-stone-950"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Username</p>
                <p className="mt-2 text-2xl font-semibold text-stone-950">@{user.username}</p>
                {getPublicDisplayName(user) ? (
                  <p className="mt-2 text-sm font-medium text-stone-700">{getPublicDisplayName(user)}</p>
                ) : null}
                <div className="mt-5 grid gap-4 text-sm text-stone-700 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Location</p>
                    <p className="mt-1 font-semibold text-stone-900">{getPublicLocation(user) || "Not Public"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Active Listings</p>
                    <p className="mt-1 font-semibold text-stone-900">{activeListings.length}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Member Since</p>
                    <p className="mt-1 font-semibold text-stone-900">{formatMemberSince(user.createdAt)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </PageWrap>
    </AppShell>
  );
}
