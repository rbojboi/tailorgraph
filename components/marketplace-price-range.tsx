"use client";

import { useMemo, useState } from "react";

const PRICE_STOPS = [
  20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850,
  900, 950, 1000,
  1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000
] as const;

function formatPriceLabel(value: number) {
  return `$${value.toLocaleString()}`;
}

function getInitialIndex(maxPrice: string) {
  const parsed = Number(maxPrice);
  if (!maxPrice || Number.isNaN(parsed) || parsed <= 0) {
    return PRICE_STOPS.length;
  }

  const matchedIndex = PRICE_STOPS.findIndex((stop) => stop === parsed);
  if (matchedIndex >= 0) {
    return matchedIndex;
  }

  const nearestIndex = PRICE_STOPS.findIndex((stop) => stop >= parsed);
  return nearestIndex >= 0 ? nearestIndex : PRICE_STOPS.length;
}

export function MarketplacePriceRange({
  minPrice: _minPrice,
  maxPrice
}: {
  minPrice: string;
  maxPrice: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState(() => getInitialIndex(maxPrice));

  const selectedMaxPrice = useMemo(() => {
    if (selectedIndex >= PRICE_STOPS.length) {
      return "";
    }

    return PRICE_STOPS[selectedIndex].toString();
  }, [selectedIndex]);

  const summaryLabel =
    selectedIndex >= PRICE_STOPS.length
      ? "Any Price"
      : `${formatPriceLabel(PRICE_STOPS[selectedIndex])} and under`;

  return (
    <div className="rounded-[1.25rem] border border-stone-300 bg-white px-4 py-3">
      <input type="hidden" name="minPrice" value="" />
      <input type="hidden" name="maxPrice" value={selectedMaxPrice} />
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-stone-700">Price</span>
        <span className="text-sm font-semibold text-stone-950">{summaryLabel}</span>
      </div>
      <input
        type="range"
        min={0}
        max={PRICE_STOPS.length}
        step={1}
        value={selectedIndex}
        onChange={(event) => setSelectedIndex(Number(event.currentTarget.value))}
        className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-stone-200 accent-stone-950"
        aria-label="Maximum price"
      />
      <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-stone-500">
        <span>{formatPriceLabel(PRICE_STOPS[0])}</span>
        <span>{formatPriceLabel(PRICE_STOPS[PRICE_STOPS.length - 1])}</span>
      </div>
    </div>
  );
}
