"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DropdownChevron } from "@/components/dropdown-chevron";
import { canonicalBrands, getCanonicalBrandById, searchBrands, type CanonicalBrand } from "@/lib/brands";

const NO_BRAND_SELECTION = "__none__";

export function BrandFilter({
  includeBrandIds,
  excludeBrandIds
}: {
  includeBrandIds: string[];
  excludeBrandIds: string[];
}) {
  const allBrandIds = useMemo(() => canonicalBrands.map((brand) => brand.id), []);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"included" | "all">("all");
  const [query, setQuery] = useState("");
  const [includeIds, setIncludeIds] = useState(includeBrandIds);

  useEffect(() => {
    setIncludeIds(includeBrandIds);
  }, [includeBrandIds]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const includeNoneSelected = includeIds.includes(NO_BRAND_SELECTION);
  const effectiveIncludeIds = includeIds.filter((brandId) => brandId !== NO_BRAND_SELECTION);

  const includeBrands = effectiveIncludeIds
    .map((brandId) => getCanonicalBrandById(brandId))
    .filter((brand): brand is CanonicalBrand => Boolean(brand));
  const defaultAllSelected = !includeNoneSelected && effectiveIncludeIds.length === 0;
  const allIncluded =
    defaultAllSelected ||
    (effectiveIncludeIds.length === allBrandIds.length && allBrandIds.every((brandId) => effectiveIncludeIds.includes(brandId)));

  const searchedBrands = useMemo(
    () => (query.trim() ? searchBrands(query, 60) : canonicalBrands),
    [query]
  );
  const displayedBrands = useMemo(() => {
    if (viewMode === "included") {
      return searchedBrands.filter((brand) => allIncluded || effectiveIncludeIds.includes(brand.id));
    }

    return searchedBrands;
  }, [searchedBrands, viewMode, allIncluded, effectiveIncludeIds]);

  function isBrandChecked(brandId: string) {
    return allIncluded || effectiveIncludeIds.includes(brandId);
  }

  function toggleBrand(brandId: string) {
    if (allIncluded) {
      setIncludeIds(allBrandIds.filter((currentId) => currentId !== brandId));
      return;
    }

    if (effectiveIncludeIds.includes(brandId)) {
      const nextIncludeIds = effectiveIncludeIds.filter((currentId) => currentId !== brandId);
      setIncludeIds(nextIncludeIds.length > 0 ? nextIncludeIds : [NO_BRAND_SELECTION]);
      return;
    }

    if (includeNoneSelected) {
      setIncludeIds([brandId]);
      return;
    }

    setIncludeIds((current) => [...current.filter((currentId) => currentId !== NO_BRAND_SELECTION), brandId]);
  }

  function toggleAnyBrandOrMaker() {
    if (allIncluded) {
      setIncludeIds([NO_BRAND_SELECTION]);
      return;
    }

    setIncludeIds([]);
  }

  useEffect(() => {
    if (viewMode === "included" && !allIncluded && effectiveIncludeIds.length === 0) {
      setViewMode("all");
    }
  }, [allIncluded, effectiveIncludeIds.length, viewMode]);

  const summaryLabel =
    includeNoneSelected
      ? "No Brands Selected"
      : allIncluded
      ? "Any Brand or Maker"
      : `${includeBrands.length} selected`;

  return (
    <div ref={containerRef} className="relative rounded-[1.25rem] border border-stone-300 bg-white px-4 py-3">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex flex-col gap-1">
          <span className="filter-label">Brand or Maker</span>
          <span className="filter-value">{summaryLabel}</span>
        </div>
        <DropdownChevron open={open} />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-[1.25rem] border border-stone-300 bg-white p-4 shadow-[0_22px_55px_-30px_rgba(31,24,19,0.4)]">
          <div className="grid gap-3">
            <div className="flex items-center gap-3">
              <div className="relative min-w-0 flex-1">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  placeholder="Search brands or makers"
                  className="ui-sans w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 pr-11 text-sm outline-none"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear brand search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-400 transition hover:text-stone-700"
                  >
                    ×
                  </button>
                ) : null}
              </div>
              <div className="inline-flex shrink-0 rounded-full border border-stone-300 bg-stone-50 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("included")}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${viewMode === "included" ? "bg-stone-950 text-white" : "text-stone-700"}`}
                >
                  Selected
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("all")}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${viewMode === "all" ? "bg-stone-950 text-white" : "text-stone-700"}`}
                >
                  All
                </button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-2xl border border-stone-200 bg-stone-50 p-3">
              <div className="grid gap-2">
                {query.trim() || (viewMode === "included" && !allIncluded) ? null : (
                  <label className="flex items-center gap-3 rounded-xl px-2 py-1 text-sm text-stone-800 hover:bg-white">
                    <input
                      type="checkbox"
                      checked={allIncluded}
                      onChange={toggleAnyBrandOrMaker}
                      className="h-4 w-4 shrink-0 rounded border-stone-300"
                    />
                    <span>Any Brand or Maker</span>
                  </label>
                )}

                {displayedBrands.length > 0 ? (
                  displayedBrands.map((brand) => (
                    <label
                      key={brand.id}
                      className="flex items-center gap-3 rounded-xl px-2 py-1 text-sm text-stone-800 hover:bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={isBrandChecked(brand.id)}
                        onChange={() => toggleBrand(brand.id)}
                        className="h-4 w-4 shrink-0 rounded border-stone-300"
                      />
                      <span>{brand.displayName}</span>
                    </label>
                  ))
                ) : (
                  <p className="px-2 py-1 text-sm text-stone-500">
                    {viewMode === "included" ? "No included brands selected." : "No brands found."}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {includeIds.map((brandId, index) => (
        <input key={`include-${brandId}-${index}`} type="hidden" name="includeBrandId" value={brandId} />
      ))}
    </div>
  );
}
