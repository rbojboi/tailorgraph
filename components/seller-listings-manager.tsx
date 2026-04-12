import Link from "next/link";
import {
  buyShippoLabelAction,
  resolveIssueAction,
  shipOrderAction,
  updateListingStatusAction
} from "@/app/actions";
import { SellerInventoryFilterControl } from "@/components/seller-inventory-filter-control";
import { Input, Select, SectionTitle, Spec } from "@/components/ui";
import { formatDisplayValue } from "@/lib/display";
import { isShippoConfigured } from "@/lib/shippo";
import { listSellerInventory, listSellerOrders } from "@/lib/store";
import type { Listing, Order } from "@/lib/types";

export type InventoryFilter = "all" | "active" | "drafts" | "sold" | "shipped" | "completed" | "closed";

type InventoryEntry =
  | {
      kind: "listing";
      bucket: "active" | "drafts" | "closed";
      createdAt: string;
      listing: Listing;
    }
  | {
      kind: "order";
      bucket: "sold" | "shipped" | "completed";
      createdAt: string;
      order: Order;
    };

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function orderBucket(order: Order): "sold" | "shipped" | "completed" | null {
  if (order.status === "paid" || order.status === "processing") {
    return "sold";
  }

  if (order.status === "shipped" || order.status === "issue_open") {
    return "shipped";
  }

  if (order.status === "delivered") {
    return "completed";
  }

  return null;
}

function renderListingEntry(entry: Extract<InventoryEntry, { kind: "listing" }>) {
  const listing = entry.listing;

  return (
    <article key={`${entry.bucket}-${listing.id}`} className="rounded-[1.5rem] border border-stone-300 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-950">{listing.title}</h2>
          <p className="mt-1 text-sm text-stone-700">
            {[listing.brand, listing.sizeLabel].filter(Boolean).join(" - ") || "No brand or size added"}
          </p>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-800">
          {entry.bucket === "closed" ? "Archived" : formatDisplayValue(entry.bucket)}
        </span>
      </div>

      <div className="mt-4">
        <Link
          href={`/seller/listings/${listing.id}`}
          className="group block rounded-[1.5rem] border border-stone-300 bg-white p-4 transition hover:border-stone-950"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="h-24 w-24 overflow-hidden rounded-[1rem] bg-stone-100">
                {listing.media[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={listing.media[0].url} alt={listing.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-stone-500">No Media</div>
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-stone-950 group-hover:underline">{listing.title}</h3>
                <p className="mt-1 text-sm text-stone-700">
                  {formatDisplayValue(listing.category)} · Updated {formatDateLabel(listing.createdAt)}
                </p>
              </div>
            </div>
            <div className="grid gap-2 text-sm text-stone-700 sm:text-right">
              <p>
                <span className="font-semibold text-stone-950">${listing.price.toFixed(2)}</span>
              </p>
              <p>Estimated Shipping ${listing.shippingPrice.toFixed(2)}</p>
            </div>
          </div>
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {listing.status !== "active" ? (
          <form action={updateListingStatusAction}>
            <input type="hidden" name="listingId" value={listing.id} />
            <input type="hidden" name="status" value="active" />
            <button className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900">
              Publish
            </button>
          </form>
        ) : null}
        {listing.status !== "archived" ? (
          <form action={updateListingStatusAction}>
            <input type="hidden" name="listingId" value={listing.id} />
            <input type="hidden" name="status" value="archived" />
            <button className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900">
              Archive Listing
            </button>
          </form>
        ) : null}
        <Link
          href={`/seller/listings/${listing.id}`}
          className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900"
        >
          Open Listing
        </Link>
      </div>
    </article>
  );
}

function renderOrderEntry(entry: Extract<InventoryEntry, { kind: "order" }>) {
  const order = entry.order;
  const shippoEnabled = isShippoConfigured();

  return (
    <article key={`${entry.bucket}-${order.id}`} className="rounded-[1.5rem] border border-stone-300 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-950">{order.listingTitle}</h2>
          <p className="mt-1 text-sm text-stone-700">
            Buyer: {order.buyerName} · Ordered {formatDateLabel(order.createdAt)}
          </p>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-800">
          {entry.bucket === "sold" ? "Sold" : formatDisplayValue(entry.bucket)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Spec label="Sale Price" value={`$${order.amount}`} />
        <Spec label="Buyer" value={order.buyerName} />
        <Spec label="Address" value={`${order.shippingAddress.city}, ${order.shippingAddress.state}`} />
        <Spec label="Tracking" value={order.trackingNumber || "Not added"} />
      </div>

      {order.shippingLabelUrl ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={order.shippingLabelUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900"
          >
            Open Shipping Label
          </a>
          {order.trackingUrl ? (
            <a
              href={order.trackingUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900"
            >
              Open Tracking
            </a>
          ) : null}
        </div>
      ) : null}

      {order.status === "paid" || order.status === "processing" ? (
        <div className="mt-4 grid gap-4">
          {shippoEnabled ? (
            <form action={buyShippoLabelAction} className="rounded-[1.25rem] border border-stone-300 bg-stone-50 p-4">
              <input type="hidden" name="orderId" value={order.id} />
              <p className="text-sm font-semibold text-stone-950">Buy Shippo label</p>
              <p className="mt-2 text-sm text-stone-700">
                Uses your first saved address in Account Settings as the sender and return address, then buys the
                lowest Shippo rate for this order.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Input name="sellerNotes" label="Seller notes" defaultValue={order.sellerNotes || ""} type="text" />
              </div>
              <div className="mt-3">
                <button className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
                  Buy Cheapest Shippo Label
                </button>
              </div>
            </form>
          ) : null}

          {shippoEnabled ? (
            <Link
              href={`/seller/orders/${order.id}/shippo`}
              className="inline-flex w-fit rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900"
            >
              Compare Shippo Rates
            </Link>
          ) : null}

          <form action={shipOrderAction} className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="orderId" value={order.id} />
            <Input name="carrier" label="Carrier" type="text" />
            <Input name="trackingNumber" label="Tracking or pickup ref" defaultValue={order.trackingNumber || ""} />
            <Input name="sellerNotes" label="Seller notes" defaultValue={order.sellerNotes || ""} type="text" />
            <div className="sm:col-span-3">
              <button className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900">
                Mark as shipped manually
              </button>
            </div>
          </form>
          {!shippoEnabled ? (
            <p className="text-sm text-stone-600">
              Add `SHIPPO_API_TOKEN` to enable one-click label buying here.
            </p>
          ) : null}
        </div>
      ) : null}

      {order.trackingStatus || order.shippingEta ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {order.trackingStatus ? <Spec label="Tracking Status" value={formatDisplayValue(order.trackingStatus)} /> : null}
          {order.shippingEta ? <Spec label="ETA" value={formatDateLabel(order.shippingEta)} /> : null}
        </div>
      ) : null}

      {order.status === "issue_open" ? (
        <form action={resolveIssueAction} className="mt-4 grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="orderId" value={order.id} />
          <Select
            name="resolution"
            label="Resolution"
            defaultValue="processing"
            options={[
              ["processing", "Keep order active"],
              ["refund", "Refund and relist"],
              ["cancel", "Cancel and relist"]
            ]}
          />
          <Input name="sellerNotes" label="Resolution notes" defaultValue={order.sellerNotes || ""} type="text" />
          <div className="sm:col-span-3">
            <button className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900">
              Resolve issue
            </button>
          </div>
        </form>
      ) : null}
    </article>
  );
}

export async function SellerListingsManager({
  userId,
  currentFilter
}: {
  userId: string;
  currentFilter: InventoryFilter;
}) {
  const inventory = await listSellerInventory(userId);
  const sales = await listSellerOrders(userId);

  const inventoryEntries: InventoryEntry[] = [
    ...inventory.flatMap((listing): InventoryEntry[] => {
      if (listing.status === "active") {
        return [{ kind: "listing", bucket: "active", createdAt: listing.createdAt, listing }];
      }

      if (listing.status === "draft") {
        return [{ kind: "listing", bucket: "drafts", createdAt: listing.createdAt, listing }];
      }

      if (listing.status === "archived") {
        return [{ kind: "listing", bucket: "closed", createdAt: listing.createdAt, listing }];
      }

      return [];
    }),
    ...sales.flatMap((order): InventoryEntry[] => {
      const bucket = orderBucket(order);
      return bucket ? [{ kind: "order", bucket, createdAt: order.createdAt, order }] : [];
    })
  ]
    .filter((entry) => currentFilter === "all" || entry.bucket === currentFilter)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  return (
    <article className="panel rounded-[1.75rem] p-6">
      <SectionTitle
        eyebrow="Items"
        title="Manage Listings"
        description="Move between drafts, live listings, sold items, shipments, completed sales, and archived listings from one view."
      />
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/seller/listings/new"
          className="rounded-full bg-stone-950 px-4 py-3 text-sm font-semibold text-white"
        >
          Create New Listing
        </Link>
        <SellerInventoryFilterControl currentFilter={currentFilter} />
      </div>

      <div className="mt-6 grid gap-4">
        {inventoryEntries.length ? (
          inventoryEntries.map((entry) => (entry.kind === "listing" ? renderListingEntry(entry) : renderOrderEntry(entry)))
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-600">
            No inventory items in this view yet.
          </div>
        )}
      </div>
    </article>
  );
}
