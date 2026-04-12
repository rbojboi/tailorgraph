"use client";

export function MarketplaceSortControl({
  currentSort,
  hiddenFields
}: {
  currentSort: string;
  hiddenFields: Array<{ key: string; value: string }>;
}) {
  return (
    <form className="flex items-center gap-3">
      {hiddenFields.map(({ key, value }, index) => (
        <input key={`${key}-${index}`} type="hidden" name={key} value={value} />
      ))}
      <label className="flex items-center gap-3 text-sm text-stone-700">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Sort</span>
        <select
          name="sort"
          defaultValue={currentSort}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="min-w-[12rem] rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-900 outline-none"
        >
          <option value="recommended">Recommended</option>
          <option value="price_low">Price Low to High</option>
          <option value="price_high">Price High to Low</option>
          <option value="newest">Newest Added</option>
          <option value="oldest">Oldest Added</option>
        </select>
      </label>
    </form>
  );
}
