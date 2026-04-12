"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { saveOrderRatingAction } from "@/app/actions";

export function OrderRatingStars({
  orderId,
  currentRating,
  returnTo
}: {
  orderId: string;
  currentRating: number | null;
  returnTo: string;
}) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [pendingRating, setPendingRating] = useState<number | null>(null);
  const activeRating = pendingRating ?? currentRating ?? 0;
  const isLocked = currentRating !== null;
  const detailHref = useMemo(
    () => `/buyer/orders/${orderId}/rate${pendingRating ? `?overallRating=${pendingRating}` : ""}`,
    [orderId, pendingRating]
  );

  return (
    <div className="relative flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((ratingValue) => {
        const isFilledByHover = !isLocked && hoverRating !== null && hoverRating >= ratingValue;
        const isFilledBySelection = (isLocked || hoverRating === null) && activeRating >= ratingValue;

        return (
          <button
            key={ratingValue}
            type="button"
            onMouseEnter={() => {
              if (!isLocked) {
                setHoverRating(ratingValue);
              }
            }}
            onMouseLeave={() => {
              if (!isLocked) {
                setHoverRating(null);
              }
            }}
            onClick={() => {
              if (!isLocked) {
                setPendingRating(ratingValue);
                setHoverRating(null);
              }
            }}
            className={`text-lg leading-none transition ${
              isLocked ? "cursor-default" : "hover:scale-[1.08]"
            } ${
              isFilledByHover
                ? "text-stone-950"
                : isFilledBySelection
                  ? "text-amber-500"
                  : "text-stone-300"
            }`}
            aria-label={`${isLocked ? "Rated" : "Rate"} ${ratingValue} star${ratingValue === 1 ? "" : "s"}`}
            title={`${isLocked ? "Rated" : "Rate"} ${ratingValue} star${ratingValue === 1 ? "" : "s"}`}
          >
            <span aria-hidden="true">★</span>
          </button>
        );
      })}

      {pendingRating && !isLocked ? (
        <div className="absolute left-0 top-8 z-50 min-w-[13rem] rounded-2xl border border-stone-200 bg-white p-3 shadow-[0_18px_50px_rgba(28,25,23,0.14)]">
          <p className="text-sm font-semibold text-stone-950">Save Rating?</p>
          <p className="mt-1 text-xs text-stone-600">You can also add more detailed feedback on the full rating page.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={detailHref}
              className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-900 transition hover:border-stone-950"
            >
              Add More Rating Details
            </Link>
            <form action={saveOrderRatingAction}>
              <input type="hidden" name="orderId" value={orderId} />
              <input type="hidden" name="rating" value={pendingRating} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button className="rounded-full bg-stone-950 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-stone-800">
                Save Rating
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
