"use client";

import { useState } from "react";

export function RatingStarsInput({
  name,
  label,
  defaultValue,
  variant = "detail"
}: {
  name: string;
  label: string;
  defaultValue?: number | null;
  variant?: "overall" | "detail";
}) {
  const [selectedRating, setSelectedRating] = useState<number>(defaultValue ?? 0);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const activeRating = hoverRating ?? selectedRating;
  const isOverall = variant === "overall";

  return (
    <div className={isOverall ? "grid justify-items-center gap-3 text-center" : "flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"}>
      <input type="hidden" name={name} value={selectedRating ? String(selectedRating) : ""} />
      <p className={isOverall ? "text-sm font-semibold uppercase tracking-[0.22em] text-stone-500" : "text-sm font-medium text-stone-700"}>
        {label}
      </p>
      <div className={isOverall ? "rounded-full border border-stone-300 bg-white px-4 py-3 shadow-[0_12px_30px_-24px_rgba(28,25,23,0.5)]" : "rounded-full border border-stone-300 bg-white px-3 py-2"}>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((ratingValue) => (
            <button
              key={ratingValue}
              type="button"
              onMouseEnter={() => setHoverRating(ratingValue)}
              onMouseLeave={() => setHoverRating(null)}
              onClick={() => setSelectedRating(ratingValue)}
              className={`leading-none transition hover:scale-[1.08] ${
                isOverall ? "text-[1.9rem]" : "text-2xl"
              } ${activeRating >= ratingValue ? "text-amber-500" : "text-stone-300"} ${
                hoverRating !== null && hoverRating >= ratingValue ? "text-stone-950" : ""
              }`}
              aria-label={`${label}: ${ratingValue} star${ratingValue === 1 ? "" : "s"}`}
              title={`${label}: ${ratingValue} star${ratingValue === 1 ? "" : "s"}`}
            >
              <span aria-hidden="true">★</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
