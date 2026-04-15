import Image from "next/image";
import Link from "next/link";
import { HeroSlideshow } from "@/components/hero-slideshow";
import { AppShell, PageWrap } from "@/components/ui";
import type { Listing } from "@/lib/types";
import { ensureSeedData, isDatabaseConfigured, listMarketplace } from "@/lib/store";

const marketplaceHighlights = [
  {
    title: "Search by what actually matters",
    description: "Filter by garment measurements, fit logic, fabric, era, and menswear-specific details instead of relying on tagged sizes alone."
  },
  {
    title: "Use your saved fit profile",
    description: "Store the measurements that work for you and let TailorGraph surface stronger matches across the marketplace."
  },
  {
    title: "Shop with tailoring in mind",
    description: "See garments that work as-is, pieces that can be improved with tailoring, and the details that make the difference."
  }
];

const marketplaceSteps = [
  "Save the measurements from garments that already fit you well.",
  "Browse the marketplace by measurements, garment details, and fit mode.",
  "Review listing specifics before you buy, make an offer, or save an item."
];

const categorySpotlights = [
  {
    key: "suits",
    label: "Suits",
    categories: ["two_piece_suit", "three_piece_suit"],
    href: "/marketplace?category=two_piece_suit&category=three_piece_suit"
  },
  {
    key: "jackets",
    label: "Jackets",
    categories: ["jacket"],
    href: "/marketplace?category=jacket"
  },
  {
    key: "trousers",
    label: "Trousers",
    categories: ["trousers"],
    href: "/marketplace?category=trousers"
  },
  {
    key: "coats",
    label: "Coats",
    categories: ["coat"],
    href: "/marketplace?category=coat"
  },
  {
    key: "shirts",
    label: "Shirts",
    categories: ["shirt"],
    href: "/marketplace?category=shirt"
  },
  {
    key: "sweaters",
    label: "Sweaters",
    categories: ["sweater"],
    href: "/marketplace?category=sweater"
  }
] as const;

type SpotlightCategory = Listing["category"];
type CategorySpotlight = {
  key: string;
  label: string;
  categories: readonly SpotlightCategory[];
  href: string;
};

function imageMediaForListing(listing: Listing) {
  return listing.media.find((media) => media.kind === "image") ?? null;
}

function buildCategoryTiles(listings: Listing[]) {
  const usedListingIds = new Set<string>();

  return (categorySpotlights as readonly CategorySpotlight[]).map((spotlight) => {
    const matchingListings = listings.filter((listing) => spotlight.categories.includes(listing.category));
    const selectedListing =
      matchingListings.find((listing) => {
        if (usedListingIds.has(listing.id)) {
          return false;
        }

        return Boolean(imageMediaForListing(listing));
      }) ??
      matchingListings.find((listing) => Boolean(imageMediaForListing(listing))) ??
      null;

    if (selectedListing) {
      usedListingIds.add(selectedListing.id);
    }

    return {
      ...spotlight,
      listing: selectedListing,
      image: selectedListing ? imageMediaForListing(selectedListing) : null
    };
  });
}

export default async function HomePage() {
  await ensureSeedData();
  const marketplaceListings = isDatabaseConfigured()
    ? (await listMarketplace()).filter((listing) => listing.status === "active")
    : [];
  const categoryTiles = buildCategoryTiles(marketplaceListings);

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-7xl overflow-hidden border-b border-stone-300/70 pb-10 pt-2">
        <div className="relative min-h-[26rem] overflow-hidden rounded-[1.35rem] sm:min-h-[29rem] lg:min-h-[36rem]">
          <div className="absolute inset-0">
            <HeroSlideshow className="absolute inset-0" fillContainer softEdges={false} />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-[rgba(252,252,250,0.96)] via-[rgba(252,252,250,0.82)] via-42% to-[rgba(252,252,250,0.12)] to-[82%]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(252,252,250,0.14)] via-transparent to-[rgba(252,252,250,0.06)]" />
          <div className="relative z-10 flex min-h-[26rem] items-center px-4 sm:min-h-[29rem] sm:px-5 lg:min-h-[36rem] lg:px-6">
              <div className="min-w-0 max-w-xl self-center">
                <div className="editorial flex flex-col gap-5 text-stone-950">
                  <h1 className="text-[3rem] font-semibold leading-[0.94] sm:text-[3.8rem]">
                    TailorGraph
                  </h1>
                  <p className="text-[1.5rem] font-semibold leading-tight sm:text-[1.9rem]">
                    The smart way to shop menswear.
                  </p>
                </div>
                <div className="editorial mt-8 max-w-xl text-lg leading-8 text-stone-700 lg:max-w-[35rem]">
                  <p>Use your measurements to find garments that actually fit.</p>
                  <p className="mt-1">
                    Refine by cut, fabric, construction, and more.
                  </p>
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/marketplace" className="inline-flex items-center rounded-[0.95rem] bg-[var(--accent)] px-7 py-4 text-[1.05rem] font-semibold text-white transition hover:brightness-95">
                    Browse Marketplace
                  </Link>
                  <Link href="/how-to-use" className="inline-flex items-center rounded-[0.95rem] border border-stone-300 bg-white px-7 py-4 text-[1.05rem] font-semibold text-stone-700 transition hover:border-stone-500 hover:bg-stone-50 hover:text-stone-950">
                    Learn How It Works
                  </Link>
                </div>
              </div>
          </div>
        </div>
      </section>

      <PageWrap maxWidth="max-w-7xl">
        <section className="border-b border-stone-300/70 pb-10 pt-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-end">
            <div className="max-w-2xl pt-0">
              <h2 className="editorial mt-0 text-[2rem] font-semibold leading-tight text-stone-950">
                Browse the Marketplace
              </h2>
              <p className="mt-3 text-base leading-7 text-stone-700">
                Start with a category or simply view all listings.
              </p>
            </div>
            <div className="flex xl:justify-end">
              <Link
                href="/marketplace"
                className="inline-flex items-center rounded-[0.95rem] border border-[color:rgba(110,53,33,0.22)] bg-[var(--accent)] px-7 py-4 text-[1.02rem] font-semibold text-white transition hover:brightness-95"
              >
                View All Listings
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {categoryTiles.map((tile) => (
              <Link
                key={tile.key}
                href={tile.href}
                className="group overflow-hidden rounded-[1.35rem] border border-stone-300/80 bg-white/70 transition duration-200 hover:-translate-y-0.5 hover:border-stone-500 hover:shadow-[0_14px_28px_rgba(58,43,28,0.07)]"
              >
                <div className="px-5 pb-3 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="editorial text-[1.55rem] font-semibold leading-tight text-stone-950">{tile.label}</h3>
                    <span className="text-sm font-medium text-stone-500 transition group-hover:text-stone-800">
                      View
                    </span>
                  </div>
                </div>
                <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
                  {tile.image ? (
                    <Image
                      src={tile.image.url}
                      alt={tile.listing?.title || `${tile.label} listing preview`}
                      fill
                      className="object-cover transition duration-500 group-hover:scale-[1.02]"
                      sizes="(min-width: 1280px) 29vw, (min-width: 768px) 45vw, 100vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-[var(--marketplace-pane-surface)] px-6 text-center text-sm text-stone-500">
                      Tailored listings appear here.
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-8 pt-2 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="border-b border-stone-300/70 pb-8 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
            <h2 className="editorial mt-3 text-[2rem] font-semibold leading-tight text-stone-950">
              A calmer way to shop for tailored clothing online.
            </h2>
            <p className="mt-4 max-w-md text-base leading-7 text-stone-700">
              TailorGraph is designed for buyers who care about whether a garment can truly work, not just whether the tag sounds right.
            </p>

            <div className="mt-8 grid gap-4">
              {marketplaceHighlights.map((highlight) => (
                <article key={highlight.title} className="rounded-[1.2rem] border border-stone-300/80 bg-white/75 px-5 py-5">
                  <h3 className="text-base font-semibold text-stone-950">{highlight.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-700">{highlight.description}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:pl-2">
            <div className="rounded-[1.4rem] border border-stone-300/80 bg-white/70 px-6 py-6">
              <h2 className="editorial mt-3 text-[1.85rem] font-semibold leading-tight text-stone-950">
                Start with measurements. Refine with garment details. Shop with confidence.
              </h2>
              <div className="mt-6 grid gap-4">
                {marketplaceSteps.map((step, index) => (
                  <div key={step} className="grid grid-cols-[2.5rem_1fr] items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-300 bg-[var(--nav-surface)] text-sm font-semibold text-stone-900">
                      {index + 1}
                    </div>
                    <p className="pt-1 text-sm leading-6 text-stone-700">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Link href="/marketplace" className="rounded-[1.3rem] border border-stone-300/80 bg-[var(--marketplace-pane-surface)] px-5 py-5 transition hover:border-stone-500">
                <h3 className="editorial mt-2 text-[1.55rem] font-semibold text-stone-950">Browse Live Listings</h3>
                <p className="mt-2 text-sm leading-6 text-stone-700">
                  Explore garments by fit mode, measurements, fabric, brand, and more.
                </p>
              </Link>

              <Link href="/signup" className="rounded-[1.3rem] border border-stone-300/80 bg-white/75 px-5 py-5 transition hover:border-stone-500">
                <h3 className="editorial mt-2 text-[1.55rem] font-semibold text-stone-950">Build Your Fit Profile</h3>
                <p className="mt-2 text-sm leading-6 text-stone-700">
                  Save measurements, track listings, and use TailorGraph as a true fit-first marketplace.
                </p>
              </Link>
            </div>
          </div>
        </section>
      </PageWrap>
    </AppShell>
  );
}
