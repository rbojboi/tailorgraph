"use client";

import { useState } from "react";
import type { ListingMedia } from "@/lib/types";

export function ListingGallery({
  media,
  title
}: {
  media: ListingMedia[];
  title: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeMedia = media[activeIndex];

  function showPrevious() {
    setActiveIndex((current) => (current === 0 ? media.length - 1 : current - 1));
  }

  function showNext() {
    setActiveIndex((current) => (current === media.length - 1 ? 0 : current + 1));
  }

  return (
    <div className="overflow-hidden rounded-[1.75rem] bg-stone-100">
      <div className="relative">
        <div className="h-[28rem] w-full">
          {activeMedia ? (
            activeMedia.kind === "video" ? (
              <video src={activeMedia.url} controls className="h-full w-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activeMedia.url} alt={title} className="h-full w-full object-cover" />
            )
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-stone-500">
              No listing media uploaded yet
            </div>
          )}
        </div>

        {media.length > 1 ? (
          <>
            <button
              type="button"
              onClick={showPrevious}
              className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl text-stone-900 shadow-sm"
              aria-label="Previous image"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={showNext}
              className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl text-stone-900 shadow-sm"
              aria-label="Next image"
            >
              ›
            </button>
          </>
        ) : null}
      </div>

      {media.length > 1 ? (
        <div className="flex flex-wrap gap-2 border-t border-stone-200 bg-white px-4 py-4">
          {media.map((item, index) => (
            <button
              key={`${item.url}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`overflow-hidden rounded-2xl border ${
                activeIndex === index ? "border-stone-950" : "border-stone-200"
              }`}
              aria-label={`Show media ${index + 1}`}
            >
              {item.kind === "video" ? (
                <video src={item.url} className="h-16 w-16 object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt={item.originalName} className="h-16 w-16 object-cover" />
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
