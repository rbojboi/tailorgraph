"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DropdownChevron } from "@/components/dropdown-chevron";

const NO_SELECTION = "__none__";

function normalizeSearchText(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

export function SearchableChecklistFilter({
  name,
  label,
  options,
  selectedValues,
  allLabel,
  description,
  optionColumns = 1,
  fullWidthAllOption = false,
  selectionMode = "multiple"
}: {
  name: string;
  label: string;
  options: Array<[string, string]>;
  selectedValues: string[];
  allLabel: string;
  description?: string;
  optionColumns?: 1 | 2;
  fullWidthAllOption?: boolean;
  selectionMode?: "single" | "multiple";
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const optionValues = useMemo(() => options.map(([value]) => value), [options]);
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"selected" | "all">("all");
  const [query, setQuery] = useState("");
  const [values, setValues] = useState(selectedValues.filter(Boolean));

  useEffect(() => {
    setValues(selectedValues.filter(Boolean));
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

  const hasExplicitNoneSelected = values.includes(NO_SELECTION);
  const explicitSelectedValues = values.filter((value) => value !== NO_SELECTION);
  const allSelected =
    !hasExplicitNoneSelected &&
    (explicitSelectedValues.length === 0 ||
      (explicitSelectedValues.length === optionValues.length && optionValues.every((value) => explicitSelectedValues.includes(value))));

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    const baseOptions = normalizedQuery
      ? options.filter(([, optionLabel]) => normalizeSearchText(optionLabel).includes(normalizedQuery))
      : options;

    if (viewMode === "selected") {
      return baseOptions.filter(([value]) => allSelected || explicitSelectedValues.includes(value));
    }

    return baseOptions;
  }, [allSelected, explicitSelectedValues, options, query, viewMode]);

  useEffect(() => {
    if (viewMode === "selected" && !allSelected && explicitSelectedValues.length === 0) {
      setViewMode("all");
    }
  }, [allSelected, explicitSelectedValues.length, viewMode]);

  function isChecked(value: string) {
    return allSelected || explicitSelectedValues.includes(value);
  }

  function toggleOption(value: string) {
    if (selectionMode === "single") {
      if (allSelected) {
        setValues([value]);
        return;
      }

      if (explicitSelectedValues.includes(value)) {
        setValues([NO_SELECTION]);
        return;
      }

      setValues([value]);
      return;
    }

    if (allSelected) {
      setValues(optionValues.filter((optionValue) => optionValue !== value));
      return;
    }

    if (explicitSelectedValues.includes(value)) {
      const nextValues = explicitSelectedValues.filter((optionValue) => optionValue !== value);
      setValues(nextValues.length > 0 ? nextValues : [NO_SELECTION]);
      return;
    }

    if (hasExplicitNoneSelected) {
      setValues([value]);
      return;
    }

    setValues([...explicitSelectedValues, value]);
  }

  function toggleAll() {
    if (allSelected) {
      setValues([NO_SELECTION]);
      return;
    }

    setValues([]);
  }

  const summaryLabel =
    hasExplicitNoneSelected
      ? "None Selected"
      : allSelected
      ? allLabel
      : explicitSelectedValues.length === 1
      ? options.find(([value]) => value === explicitSelectedValues[0])?.[1] ?? allLabel
      : `${explicitSelectedValues.length} Selected`;

  return (
    <div ref={containerRef} className="relative rounded-[1.25rem] border border-stone-300 bg-white px-4 py-3">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex flex-col gap-1">
          <span className="filter-label">{label}</span>
          <span className="filter-value">{summaryLabel}</span>
          {description ? <span className="filter-help">{description}</span> : null}
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
                  placeholder={`Search ${label.toLowerCase()}`}
                  className="ui-sans w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 pr-11 text-sm outline-none"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label={`Clear ${label.toLowerCase()} search`}
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
              <div className={`grid gap-2 ${optionColumns === 2 ? "sm:grid-cols-2" : ""}`}>
                {query.trim() || (viewMode === "selected" && !allSelected) ? null : (
                  <label
                    className={`flex items-center gap-3 rounded-xl px-2 py-1 text-sm text-stone-800 hover:bg-white ${fullWidthAllOption && optionColumns === 2 ? "sm:col-span-2" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="h-4 w-4 shrink-0 rounded border-stone-300"
                    />
                    <span>{allLabel}</span>
                  </label>
                )}

                {filteredOptions.length > 0 ? (
                  filteredOptions.map(([value, optionLabel]) => (
                    <label
                      key={value}
                      className="flex items-center gap-3 rounded-xl px-2 py-1 text-sm text-stone-800 hover:bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked(value)}
                        onChange={() => toggleOption(value)}
                        className="h-4 w-4 shrink-0 rounded border-stone-300"
                      />
                      <span>{optionLabel}</span>
                    </label>
                  ))
                ) : (
                  <p className={`px-2 py-1 text-sm text-stone-500 ${optionColumns === 2 ? "sm:col-span-2" : ""}`}>
                    {viewMode === "selected" ? "No selected options." : "No options found."}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {values.map((value, index) => (
        <input key={`${value}-${index}`} type="hidden" name={name} value={value} />
      ))}
    </div>
  );
}
