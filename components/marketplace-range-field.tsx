"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, FocusEvent } from "react";

function formatQuarterValue(value: number) {
  return Number(value.toFixed(2)).toString();
}

function normalizePositiveQuarterValue(event: FocusEvent<HTMLInputElement>) {
  const rawValue = event.currentTarget.value.trim();
  if (!rawValue) {
    return;
  }

  const numericValue = Number(rawValue);
  if (Number.isNaN(numericValue)) {
    event.currentTarget.value = "";
    return;
  }

  const roundedValue = Math.round(Math.max(0, numericValue) / 0.25) * 0.25;
  event.currentTarget.value = formatQuarterValue(roundedValue);
}

export function MarketplaceRangeField({
  minName,
  maxName,
  label,
  minDefaultValue,
  maxDefaultValue,
  placeholder,
  allowanceName,
  allowanceChecked = false,
  onAllowanceChange
}: {
  minName: string;
  maxName: string;
  label: string;
  minDefaultValue?: string;
  maxDefaultValue?: string;
  placeholder: string;
  allowanceName?: string;
  allowanceChecked?: boolean;
  onAllowanceChange?: (checked: boolean) => void;
}) {
  const [minValue, setMinValue] = useState(minDefaultValue ?? "");
  const [maxValue, setMaxValue] = useState(maxDefaultValue ?? "");
  const [allowanceValue, setAllowanceValue] = useState(Boolean(allowanceChecked));

  useEffect(() => {
    setAllowanceValue(Boolean(allowanceChecked));
  }, [allowanceChecked]);

  const handleAllowanceChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextChecked = event.currentTarget.checked;
    setAllowanceValue(nextChecked);
    onAllowanceChange?.(nextChecked);
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="filter-label">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        <input
          name={minName}
          type="number"
          value={minValue}
          placeholder={`Min ${placeholder}`}
          step={0.25}
          min={0}
          onChange={(event) => setMinValue(event.currentTarget.value)}
          onBlur={(event) => {
            normalizePositiveQuarterValue(event);
            setMinValue(event.currentTarget.value);
          }}
          className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none"
        />
        <input
          name={maxName}
          type="number"
          value={maxValue}
          placeholder={`Max ${placeholder}`}
          step={0.25}
          min={0}
          onChange={(event) => setMaxValue(event.currentTarget.value)}
          onBlur={(event) => {
            normalizePositiveQuarterValue(event);
            setMaxValue(event.currentTarget.value);
          }}
          className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none"
        />
      </div>
      {allowanceName ? (
        <label className="flex items-center gap-2 text-xs text-stone-700">
          <input type="hidden" name={allowanceName} value="no" />
          <input
            type="checkbox"
            name={allowanceName}
            value="yes"
            checked={allowanceValue}
            onChange={handleAllowanceChange}
            className="h-4 w-4 shrink-0 rounded border-stone-300"
          />
          <span>Include Allowance</span>
        </label>
      ) : null}
    </div>
  );
}
