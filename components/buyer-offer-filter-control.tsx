"use client";

export function BuyerOfferFilterControl({
  currentFilter
}: {
  currentFilter: string;
}) {
  return (
    <form className="flex justify-end">
      <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
        <span>Show:</span>
        <select
          name="offerStatus"
          defaultValue={currentFilter}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm outline-none"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
      </label>
    </form>
  );
}
