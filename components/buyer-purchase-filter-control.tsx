"use client";

export function BuyerPurchaseFilterControl({
  currentFilter
}: {
  currentFilter: string;
}) {
  return (
    <form className="flex justify-end">
      <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
        <span>Show:</span>
        <select
          name="purchaseStatus"
          defaultValue={currentFilter}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm outline-none"
        >
          <option value="all">All</option>
          <option value="return_eligible">Return Eligible</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="canceled">Canceled</option>
        </select>
      </label>
    </form>
  );
}
