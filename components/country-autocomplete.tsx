"use client";

import { useMemo, useRef, useState } from "react";
import { getCountryById, resolveCountry, searchCountrySuggestions } from "@/lib/countries";

export function CountryAutocomplete({
  name,
  queryName,
  label,
  defaultValue = ""
}: {
  name: string;
  queryName: string;
  label: string;
  defaultValue?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const defaultCountry = getCountryById(defaultValue);
  const [query, setQuery] = useState(defaultCountry?.displayName ?? "");
  const [isFocused, setIsFocused] = useState(false);
  const [selectedCountryId, setSelectedCountryId] = useState(defaultValue);
  const [hasCommittedSelection, setHasCommittedSelection] = useState(Boolean(defaultValue));

  const selectedDisplay = useMemo(() => {
    const resolved = resolveCountry(query);
    if (resolved) {
      return resolved.id;
    }

    return selectedCountryId;
  }, [query, selectedCountryId]);

  const searchResults = useMemo(() => searchCountrySuggestions(query, 8, "seller"), [query]);
  const fallbackResults = useMemo(() => {
    if (!query.trim() || searchResults.length > 0) {
      return [];
    }

    return [
      { countryId: "other", displayName: "Other", score: 100, matchType: "canonical_prefix" as const },
      { countryId: "unknown", displayName: "Unknown", score: 101, matchType: "canonical_prefix" as const }
    ];
  }, [query, searchResults]);
  const visibleResults = searchResults.length > 0 ? searchResults : fallbackResults;
  const showResults = isFocused && Boolean(query.trim()) && visibleResults.length > 0;

  return (
    <label className="relative flex flex-col gap-2">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <input type="hidden" name={name} value={selectedDisplay} />
      <input type="hidden" name={queryName} value={query} />
      <div className="relative">
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setSelectedCountryId(resolveCountry(event.currentTarget.value)?.id ?? "");
            setHasCommittedSelection(false);
          }}
          onKeyDown={(event) => {
            if (!hasCommittedSelection) {
              return;
            }

            if (event.key === "Backspace" || event.key === "Delete") {
              event.preventDefault();
              setQuery("");
              setSelectedCountryId("");
              setHasCommittedSelection(false);
              return;
            }

            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
              event.preventDefault();
              setQuery(event.key);
              setSelectedCountryId(resolveCountry(event.key)?.id ?? "");
              setHasCommittedSelection(false);
            }
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            window.setTimeout(() => setIsFocused(false), 120);
          }}
          placeholder="Search Countries"
          className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 pr-11 text-sm outline-none"
        />
        {query ? (
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              setQuery("");
              setSelectedCountryId("");
              setHasCommittedSelection(false);
              setIsFocused(true);
              inputRef.current?.focus();
            }}
            aria-label="Clear country search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-400 transition hover:text-stone-700"
          >
            ×
          </button>
        ) : null}
      </div>
      {showResults ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-2xl border border-stone-300 bg-white p-2 shadow-lg">
          <div className="grid gap-1">
            {visibleResults.map((country) => (
              <button
                key={country.countryId}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  setQuery(country.displayName);
                  setSelectedCountryId(country.countryId);
                  setHasCommittedSelection(true);
                  setIsFocused(false);
                }}
                className="rounded-xl px-3 py-2 text-left text-sm text-stone-800 transition hover:bg-stone-100"
              >
                <span className="block">{country.displayName}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </label>
  );
}
