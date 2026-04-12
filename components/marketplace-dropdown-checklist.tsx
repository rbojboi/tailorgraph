"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DropdownChevron } from "@/components/dropdown-chevron";

export function MarketplaceDropdownChecklist({
  name,
  label,
  options = [],
  selectedValues,
  allLabel,
  onSelectionChange,
  clearAllValue,
  noneLabel,
  description,
  optionColumns = 1,
  fullWidthAllOption = false
}: {
  name: string;
  label: string;
  options: Array<[string, string]>;
  selectedValues: string[];
  allLabel?: string;
  onSelectionChange?: (values: string[]) => void;
  clearAllValue?: string;
  noneLabel?: string;
  description?: string;
  optionColumns?: 1 | 2;
  fullWidthAllOption?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resolvedClearAllValue = allLabel ? (clearAllValue ?? "__none__") : clearAllValue;
  const optionValues = useMemo(() => options.map(([value]) => value), [options]);
  const normalizedInitialValues = useMemo(() => selectedValues.filter(Boolean), [selectedValues]);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<string[]>(normalizedInitialValues);

  useEffect(() => {
    setValues(normalizedInitialValues);
  }, [normalizedInitialValues]);

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

  const hasExplicitNoneSelected = Boolean(resolvedClearAllValue && values.includes(resolvedClearAllValue));
  const selectedOptionValues = hasExplicitNoneSelected
    ? []
    : values.filter((value) => value !== resolvedClearAllValue);
  const effectiveValues =
    selectedOptionValues.length === 0 && !hasExplicitNoneSelected ? optionValues : selectedOptionValues;
  const allSelected = effectiveValues.length === optionValues.length;

  function updateValues(nextValues: string[]) {
    const normalizedNextValues = nextValues.length === optionValues.length ? [] : nextValues;
    setValues(normalizedNextValues);
    onSelectionChange?.(normalizedNextValues);
  }

  function toggleValue(value: string) {
    let nextValues: string[];

    if (value === "__all__") {
      nextValues = allSelected && resolvedClearAllValue ? [resolvedClearAllValue] : [];
    } else if (allSelected) {
      nextValues = optionValues.filter((item) => item !== value);
    } else if (selectedOptionValues.includes(value)) {
      nextValues = selectedOptionValues.filter((item) => item !== value);
      if (nextValues.length === 0 && resolvedClearAllValue) {
        nextValues = [resolvedClearAllValue];
      }
    } else {
      nextValues = [...selectedOptionValues, value];
    }

    updateValues(nextValues);
  }

  const summaryLabel =
    hasExplicitNoneSelected
      ? noneLabel ?? "None Selected"
      : allSelected
        ? allLabel ?? "Any"
        : selectedOptionValues.length === 1
          ? options.find(([value]) => value === selectedOptionValues[0])?.[1] ?? allLabel
          : `${selectedOptionValues.length} Selected`;

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
        <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-[1.25rem] border border-stone-300 bg-white p-4 shadow-[0_18px_50px_rgba(28,25,23,0.16)]">
          <div className="max-h-72 overflow-y-auto rounded-2xl border border-stone-200 bg-stone-50/50 p-3">
            <div className={`grid gap-2 ${optionColumns === 2 ? "sm:grid-cols-2" : ""}`}>
              {allLabel ? (
                <label
                  className={`flex items-center gap-3 rounded-xl px-2 py-1 text-sm text-stone-800 hover:bg-white ${
                    fullWidthAllOption && optionColumns === 2 ? "sm:col-span-2" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => toggleValue("__all__")}
                    className="h-4 w-4 shrink-0 rounded border-stone-300"
                  />
                  <span>{allLabel}</span>
                </label>
              ) : null}

              {options.map(([value, optionLabel]) => (
                <label key={value} className="flex items-center gap-3 rounded-xl px-2 py-1 text-sm text-stone-800 hover:bg-white">
                  <input
                    type="checkbox"
                    checked={effectiveValues.includes(value)}
                    onChange={() => toggleValue(value)}
                    className="h-4 w-4 shrink-0 rounded border-stone-300"
                  />
                  <span>{optionLabel}</span>
                </label>
              ))}
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
