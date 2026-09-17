"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { ListingImage } from "@/components/listing-image";
import { PhotoNavigationButton } from "@/components/photo-navigation-button";
import { photoSwipe, wrapPhotoIndex, type Point } from "@/lib/photo-viewer";
import type { ListingMedia } from "@/lib/types";

const PhotoViewer = dynamic(() => import("@/components/photo-viewer"), { ssr: false });
const arrowClass = "absolute top-1/2 z-10 -translate-y-1/2";

export function ListingGallery({ media, title, variant = "detail", sizes = "(max-width: 1023px) calc(100vw - 48px), 640px" }: {
  media: ListingMedia[]; title: string; variant?: "card" | "detail"; sizes?: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const swipeStart = useRef<Point | null>(null);
  const suppressClick = useRef(false);
  const index = wrapPhotoIndex(activeIndex, media.length);
  const active = media[index];
  const isCard = variant === "card";
  const move = (direction: number) => setActiveIndex(current => wrapPhotoIndex(current + direction, media.length));

  return <div className={`pointer-events-auto relative ${isCard ? "h-full" : "overflow-hidden rounded-[1.75rem] bg-stone-100"}`}>
    <div className={`relative bg-stone-100 ${isCard ? "h-full" : "h-[28rem]"}`}>
      {!active ? <div className="flex h-full items-center justify-center text-sm text-stone-500">No photos yet</div> : active.kind === "video" ? (
        <video key={active.url} src={active.url} controls preload="none" className="h-full w-full object-contain" />
      ) : (
        <button type="button" className="block h-full w-full cursor-zoom-in touch-pan-y touch-pinch-zoom focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-stone-900"
          aria-label={`Open photos of ${title}, photo ${index + 1} of ${media.length}`} aria-haspopup="dialog"
          onPointerDown={event => {
            if (!event.isPrimary || event.button !== 0) return;
            swipeStart.current = { x: event.clientX, y: event.clientY };
            suppressClick.current = false;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={event => {
            const start = swipeStart.current;
            swipeStart.current = null;
            if (!start) return;
            const end = { x: event.clientX, y: event.clientY };
            suppressClick.current = Math.hypot(end.x - start.x, end.y - start.y) > 10;
            const direction = photoSwipe(start, end);
            if (direction) move(direction);
          }}
          onPointerCancel={() => { swipeStart.current = null; suppressClick.current = true; }}
          onClick={event => {
            if (event.detail !== 0 && suppressClick.current) { suppressClick.current = false; return; }
            setOpen(true);
          }}>
          <ListingImage src={active.url} alt={`${title} — photo ${index + 1}`} sizes={sizes} loading={isCard ? "lazy" : "eager"} className="h-full w-full select-none object-contain" />
        </button>
      )}
      {media.length > 1 ? <>
        <PhotoNavigationButton direction="previous" onClick={() => move(-1)} label={`Previous photo of ${title}`} className={`${arrowClass} left-2`} />
        <PhotoNavigationButton direction="next" onClick={() => move(1)} label={`Next photo of ${title}`} className={`${arrowClass} right-2`} />
      </> : null}
      {active ? <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
        <span role="status" aria-live="polite" aria-atomic="true" className="rounded-full bg-stone-950/80 px-3 py-1.5 text-xs font-medium text-white">{index + 1} / {media.length}</span>
        <button type="button" onClick={() => setOpen(true)} aria-label={`Expand photos of ${title}`} className="pointer-events-auto min-h-11 rounded-full border border-stone-200 bg-white/95 px-3 text-xs font-semibold text-stone-900 shadow-sm">Expand ↗</button>
      </div> : null}
    </div>
    {!isCard && media.length > 1 ? <div className="flex gap-2 overflow-x-auto border-t border-stone-200 bg-white p-3" aria-label="Photo thumbnails">
      {media.map((item, photoIndex) => <button key={`${item.url}-${photoIndex}`} type="button" onClick={() => setActiveIndex(photoIndex)}
        aria-label={`Show photo ${photoIndex + 1} of ${title}`} aria-pressed={index === photoIndex}
        className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${index === photoIndex ? "border-stone-950" : "border-transparent"}`}>
        {item.kind === "image" ? <ListingImage src={item.url} alt="" sizes="64px" className="h-full w-full object-contain" /> : <span className="text-xs">Video {photoIndex + 1}</span>}
      </button>)}
    </div> : null}
    {open && active ? <PhotoViewer media={media} title={title} index={index} onIndexChange={setActiveIndex} onClose={() => setOpen(false)} /> : null}
  </div>;
}
