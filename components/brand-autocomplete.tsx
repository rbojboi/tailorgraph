"use client";

import { useMemo, useRef, useState } from "react";
import { resolveBrand, searchBrandSuggestions } from "@/lib/brands";

export function BrandAutocomplete({
  name,
  queryName,
  label,
  defaultValue = "",
  maxLength = 80
}: {
  name: string;
  queryName: string;
  label: string;
  defaultValue?: string;
  maxLength?: number;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState(defaultValue);
  const [isFocused, setIsFocused] = useState(false);
  const [selectedCanonicalBrand, setSelectedCanonicalBrand] = useState(resolveBrand(defaultValue)?.displayName ?? "");
  const [hasCommittedSelection, setHasCommittedSelection] = useState(Boolean(resolveBrand(defaultValue)?.displayName));
  const selectedBrand = useMemo(() => {
    const resolvedDisplayName = resolveBrand(query)?.displayName;
    if (resolvedDisplayName) {
      return resolvedDisplayName;
    }

    return selectedCanonicalBrand;
  }, [query, selectedCanonicalBrand]);

  const searchResults = useMemo(() => searchBrandSuggestions(query, 8), [query]);
  const fallbackResults = useMemo(() => {
    if (!query.trim() || searchResults.length > 0) {
      return [];
    }

    return ["Other Brand", "Other Bespoke", "Unbranded"].map((displayName, index) => ({
      brandId: displayName.toLowerCase(),
      displayName,
      score: 100 + index,
      matchType: "canonical_prefix" as const
    }));
  }, [query, searchResults]);
  const visibleResults = searchResults.length > 0 ? searchResults : fallbackResults;
  const showResults = isFocused && Boolean(query.trim()) && visibleResults.length > 0;

  return (
    <label className="relative flex flex-col gap-2">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <input type="hidden" name={name} value={selectedBrand} />
      <input type="hidden" name={queryName} value={query} />
      <div className="relative">
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setSelectedCanonicalBrand(resolveBrand(event.currentTarget.value)?.displayName ?? "");
            setHasCommittedSelection(false);
          }}
          onKeyDown={(event) => {
            if (!hasCommittedSelection) {
              return;
            }

            if (event.key === "Backspace" || event.key === "Delete") {
              event.preventDefault();
              setQuery("");
              setSelectedCanonicalBrand("");
              setHasCommittedSelection(false);
              return;
            }

            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
              event.preventDefault();
              setQuery(event.key);
              setSelectedCanonicalBrand(resolveBrand(event.key)?.displayName ?? "");
              setHasCommittedSelection(false);
            }
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            window.setTimeout(() => setIsFocused(false), 120);
          }}
          placeholder="Search Brands or Makers"
          maxLength={maxLength}
          className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 pr-11 text-sm outline-none"
        />
        {query ? (
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              setQuery("");
              setSelectedCanonicalBrand("");
              setHasCommittedSelection(false);
              setIsFocused(true);
              inputRef.current?.focus();
            }}
            aria-label="Clear brand search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-400 transition hover:text-stone-700"
          >
            ×
          </button>
        ) : null}
      </div>
      {showResults ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-2xl border border-stone-300 bg-white p-2 shadow-lg">
          <div className="grid gap-1">
            {visibleResults.map((brand) => (
              <button
                key={brand.brandId}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  setQuery(brand.displayName);
                  setSelectedCanonicalBrand(brand.displayName);
                  setHasCommittedSelection(true);
                  setIsFocused(false);
                }}
                className="rounded-xl px-3 py-2 text-left text-sm text-stone-800 transition hover:bg-stone-100"
              >
                <span className="block">{brand.displayName}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </label>
  );
}
