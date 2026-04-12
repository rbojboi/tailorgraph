"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DropdownChevron } from "@/components/dropdown-chevron";
import { buyerCountryOptions, searchCountrySuggestions } from "@/lib/countries";

const NO_COUNTRY_SELECTION = "__none__";

export function CountryFilter({
  selectedValues
}: {
  selectedValues: string[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const allCountryIds = useMemo(() => buyerCountryOptions.map(([value]) => value), []);
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"selected" | "all">("all");
  const [query, setQuery] = useState("");
  const [values, setValues] = useState(selectedValues);

  useEffect(() => {
    setValues(selectedValues);
  }, [selectedValues]);

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

  const noneSelected = values.includes(NO_COUNTRY_SELECTION);
  const explicitSelected = values.filter((value) => value !== NO_COUNTRY_SELECTION);
  const allSelected =
    !noneSelected &&
    (explicitSelected.length === 0 ||
      (explicitSelected.length === allCountryIds.length && allCountryIds.every((value) => explicitSelected.includes(value))));

  const searchedOptions = useMemo(() => {
    if (!query.trim()) {
      return buyerCountryOptions;
    }

    return searchCountrySuggestions(query, 60, "buyer").map((country) => [country.countryId, country.displayName] as [string, string]);
  }, [query]);

  const displayedOptions = useMemo(() => {
    if (viewMode === "selected") {
      return searchedOptions.filter(([value]) => allSelected || explicitSelected.includes(value));
    }

    return searchedOptions;
  }, [allSelected, explicitSelected, searchedOptions, viewMode]);

  useEffect(() => {
    if (viewMode === "selected" && !allSelected && explicitSelected.length === 0) {
      setViewMode("all");
    }
  }, [allSelected, explicitSelected.length, viewMode]);

  function isChecked(value: string) {
    return allSelected || explicitSelected.includes(value);
  }

  function toggleValue(value: string) {
    if (allSelected) {
      setValues(allCountryIds.filter((currentValue) => currentValue !== value));
      return;
    }

    if (explicitSelected.includes(value)) {
      const nextValues = explicitSelected.filter((currentValue) => currentValue !== value);
      setValues(nextValues.length > 0 ? nextValues : [NO_COUNTRY_SELECTION]);
      return;
    }

    if (noneSelected) {
      setValues([value]);
      return;
    }

    setValues([...explicitSelected, value]);
  }

  function toggleAllCountries() {
    if (allSelected) {
      setValues([NO_COUNTRY_SELECTION]);
      return;
    }

    setValues([]);
  }

  const summaryLabel =
    noneSelected
      ? "None Selected"
      : allSelected
      ? "Any Country"
      : explicitSelected.length === 1
      ? buyerCountryOptions.find(([value]) => value === explicitSelected[0])?.[1] ?? "Any Country"
      : `${explicitSelected.length} Selected`;

  return (
    <div ref={containerRef} className="relative rounded-[1.25rem] border border-stone-300 bg-white px-4 py-3">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex flex-col gap-1">
          <span className="filter-label">Country of Origin</span>
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
                  placeholder="Search countries"
                  className="ui-sans w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 pr-11 text-sm outline-none"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear country search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-400 transition hover:text-stone-700"
                  >
                    ×
                  </button>
                ) : null}
              </div>
              <div className="inline-flex shrink-0 rounded-full border border-stone-300 bg-stone-50 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("selected")}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${viewMode === "selected" ? "bg-stone-950 text-white" : "text-stone-700"}`}
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
                {query.trim() || (viewMode === "selected" && !allSelected) ? null : (
                  <label className="flex items-center gap-3 rounded-xl px-2 py-1 text-sm text-stone-800 hover:bg-white">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAllCountries}
                      className="h-4 w-4 shrink-0 rounded border-stone-300"
                    />
                    <span>Any Country</span>
                  </label>
                )}

                {displayedOptions.length > 0 ? (
                  displayedOptions.map(([value, label]) => (
                    <label key={value} className="flex items-center gap-3 rounded-xl px-2 py-1 text-sm text-stone-800 hover:bg-white">
                      <input
                        type="checkbox"
                        checked={isChecked(value)}
                        onChange={() => toggleValue(value)}
                        className="h-4 w-4 shrink-0 rounded border-stone-300"
                      />
                      <span>{label}</span>
                    </label>
                  ))
                ) : (
                  <p className="px-2 py-1 text-sm text-stone-500">
                    {viewMode === "selected" ? "No selected countries." : "No countries found."}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {values.map((value, index) => (
        <input key={`${value}-${index}`} type="hidden" name="countryOfOrigin" value={value} />
      ))}
    </div>
  );
}
