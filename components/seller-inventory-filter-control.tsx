"use client";

export function SellerInventoryFilterControl({
  currentFilter
}: {
  currentFilter: string;
}) {
  return (
    <form className="flex justify-end">
      <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
        <span>Show:</span>
        <select
          name="inventoryStatus"
          defaultValue={currentFilter}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm outline-none"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="drafts">Drafts</option>
          <option value="sold">Sold</option>
          <option value="shipped">Shipped</option>
          <option value="completed">Completed</option>
          <option value="closed">Archived</option>
        </select>
      </label>
    </form>
  );
}
