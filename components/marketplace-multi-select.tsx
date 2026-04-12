"use client";

import { useEffect, useMemo, useState } from "react";

export function MarketplaceMultiSelect({
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
  const resolvedClearAllValue = allLabel ? (clearAllValue ?? "__none__") : clearAllValue;
  const optionValues = useMemo(() => options.map(([value]) => value), [options]);
  const normalizedInitialValues = useMemo(
    () => selectedValues.filter(Boolean),
    [selectedValues]
  );
  const [values, setValues] = useState<string[]>(normalizedInitialValues);

  useEffect(() => {
    setValues(normalizedInitialValues);
  }, [normalizedInitialValues]);

  const hasExplicitNoneSelected = Boolean(resolvedClearAllValue && values.includes(resolvedClearAllValue));
  const selectedOptionValues = hasExplicitNoneSelected
    ? []
    : values.filter((value) => value !== resolvedClearAllValue);
  const effectiveValues = selectedOptionValues.length === 0 && !hasExplicitNoneSelected ? optionValues : selectedOptionValues;
  const allSelected = effectiveValues.length === optionValues.length;

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

    const normalizedNextValues = nextValues.length === optionValues.length ? [] : nextValues;

    setValues(normalizedNextValues);
    onSelectionChange?.(normalizedNextValues);
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
    <details className="rounded-[1.25rem] border border-stone-300 bg-white px-4 py-3">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-1">
          <span className="filter-label">{label}</span>
          <span className="filter-value">{summaryLabel}</span>
          {description ? <span className="filter-help">{description}</span> : null}
        </div>
      </summary>

      <div className={`mt-4 grid gap-2 ${optionColumns === 2 ? "sm:grid-cols-2" : ""}`}>
        {allLabel ? (
          <label
            className={`flex items-center gap-3 text-sm text-stone-800 ${fullWidthAllOption && optionColumns === 2 ? "sm:col-span-2" : ""}`}
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
          <label
            key={value}
            className="flex items-center gap-3 text-sm text-stone-800"
          >
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

      {values.map((value, index) => (
        <input key={`${value}-${index}`} type="hidden" name={name} value={value} />
      ))}
    </details>
  );
}
