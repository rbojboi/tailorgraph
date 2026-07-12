import Link from "next/link";
import { redirect } from "next/navigation";
import { SellerListingsManager, type InventoryFilter } from "@/components/seller-listings-manager";
import { AppShell, PageWrap } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeedData } from "@/lib/store";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isInventoryFilter(value: string | undefined): value is InventoryFilter {
  return value === "all"
    || value === "active"
    || value === "drafts"
    || value === "sold"
    || value === "shipped"
    || value === "completed"
    || value === "closed";
}

function savedMessage(saved: string) {
  switch (saved) {
    case "listing-created":
      return "Listing created.";
    case "draft-created":
      return "Draft saved.";
    case "listing":
      return "Listing saved.";
    default:
      return `Saved ${saved}.`;
  }
}

export default async function SellerListingsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  await ensureSeedData();
  const user = await getCurrentUser();

  if (!user || (user.role !== "seller" && user.role !== "both")) {
    redirect("/?authError=Seller+account+required+to+access+manage+listings");
  }

  const requestedInventoryStatus = firstValue(params.inventoryStatus);
  const inventoryStatus: InventoryFilter = isInventoryFilter(requestedInventoryStatus) ? requestedInventoryStatus : "all";
  const saved = firstValue(params.saved);

  return (
    <AppShell>
      <PageWrap>
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow text-xs text-stone-500">Seller Dashboard</p>
              <h1 className="mt-3 text-4xl font-semibold text-stone-950">Manage Listings</h1>
            </div>
            <Link
              href="/seller"
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900"
            >
              Back to Seller Dashboard
            </Link>
          </div>
          {saved ? (
            <p className="mt-4 rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-900">
              {savedMessage(saved)}
            </p>
          ) : null}
        </section>

        <SellerListingsManager userId={user.id} currentFilter={inventoryStatus} />
      </PageWrap>
    </AppShell>
  );
}
