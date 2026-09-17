"use client";

import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { ListingImage } from "@/components/listing-image";
import { PhotoNavigationButton } from "@/components/photo-navigation-button";
import { clampPhotoTransform, INITIAL_PHOTO_TRANSFORM, photoSwipe, pinchPhotoTransform, wrapPhotoIndex, type PhotoTransform, type Point } from "@/lib/photo-viewer";
import type { ListingMedia } from "@/lib/types";

const controlClass = "inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-white/25 bg-stone-900 px-3 text-white hover:bg-stone-700 disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

function ZoomablePhoto({ src, title, onMove }: { src: string; title: string; onMove: (direction: number) => void }) {
  const stage = useRef<HTMLDivElement>(null);
  const imageSize = useRef<Point>({ x: 0, y: 0 });
  const transformRef = useRef<PhotoTransform>(INITIAL_PHOTO_TRANSFORM);
  const [transform, setTransform] = useState(INITIAL_PHOTO_TRANSFORM);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const pointers = useRef(new Map<number, Point>());
  const start = useRef<{ points: Point[]; transform: PhotoTransform; pinched: boolean } | null>(null);
  const dragged = useRef(false);
  const lastTap = useRef<{ time: number; point: Point } | null>(null);
  const lastPointerType = useRef("");

  function update(next: PhotoTransform) {
    const rect = stage.current?.getBoundingClientRect();
    if (!rect) return;
    const bounded = clampPhotoTransform(next, { x: rect.width, y: rect.height }, imageSize.current);
    transformRef.current = bounded;
    setTransform(bounded);
  }
  function zoomTo(zoom: number) { update({ ...transformRef.current, zoom }); }
  function point(event: ReactPointerEvent): Point {
    const rect = stage.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
  }
  function endPointer(event: ReactPointerEvent, cancelled: boolean) {
    if (!pointers.current.has(event.pointerId)) return;
    const gesture = start.current;
    const end = point(event);
    pointers.current.delete(event.pointerId);
    if (!pointers.current.size) {
      start.current = null;
      if (!cancelled && gesture && !gesture.pinched && gesture.transform.zoom === 1) {
        const direction = photoSwipe(gesture.points[0], end);
        if (direction) onMove(direction);
      }
      if (!cancelled && gesture && !gesture.pinched && !dragged.current && event.pointerType === "touch") {
        const previous = lastTap.current;
        if (previous && event.timeStamp - previous.time < 300 && Math.hypot(end.x - previous.point.x, end.y - previous.point.y) < 30) {
          zoomTo(transformRef.current.zoom > 1 ? 1 : 2);
          lastTap.current = null;
        } else lastTap.current = { time: event.timeStamp, point: end };
      } else lastTap.current = null;
    } else {
      start.current = { points: [...pointers.current.values()], transform: transformRef.current, pinched: true };
    }
  }

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const next = clampPhotoTransform(transformRef.current, { x: element.clientWidth, y: element.clientHeight }, imageSize.current);
      transformRef.current = next;
      setTransform(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div className="flex min-h-0 flex-1 flex-col">
    <div ref={stage} role="group" aria-label="Zoomable photo" className={`relative min-h-0 flex-1 touch-none overflow-hidden ${transform.zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
      onDoubleClick={() => { if (!dragged.current && lastPointerType.current !== "touch") zoomTo(transformRef.current.zoom > 1 ? 1 : 2); }}
      onPointerDown={event => {
        if (event.button !== 0 || status !== "ready") return;
        lastPointerType.current = event.pointerType;
        event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, point(event));
        dragged.current = false;
        start.current = { points: [...pointers.current.values()], transform: transformRef.current, pinched: pointers.current.size > 1 };
      }}
      onPointerMove={event => {
        const gesture = start.current;
        if (!gesture || !pointers.current.has(event.pointerId)) return;
        pointers.current.set(event.pointerId, point(event));
        const current = [...pointers.current.values()];
        if (current.length >= 2 && gesture.points.length >= 2) {
          dragged.current = true;
          update(pinchPhotoTransform(gesture.transform, [gesture.points[0], gesture.points[1]], [current[0], current[1]]));
        } else {
          const dx = current[0].x - gesture.points[0].x, dy = current[0].y - gesture.points[0].y;
          if (Math.hypot(dx, dy) > 10) dragged.current = true;
          if (gesture.transform.zoom > 1) update({ ...gesture.transform, x: gesture.transform.x + dx, y: gesture.transform.y + dy });
        }
      }}
      onPointerUp={event => endPointer(event, false)} onPointerCancel={event => endPointer(event, true)} onLostPointerCapture={event => endPointer(event, true)}>
      {status !== "error" ? (
        // Load the stored master only inside the viewer, preserving detail when zooming.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={title} draggable={false} className="h-full w-full select-none object-contain" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})` }}
          onLoad={event => { imageSize.current = { x: event.currentTarget.naturalWidth, y: event.currentTarget.naturalHeight }; setStatus("ready"); }}
          onError={() => setStatus("error")} />
      ) : null}
      {status !== "ready" ? <div role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center p-8 text-center text-stone-300">
        {status === "loading" ? "Loading photo…" : "This photo could not be loaded. You can still browse the other photos."}
      </div> : null}
    </div>
    <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-2" aria-label="Photo zoom controls">
      <button type="button" className={controlClass} aria-label="Zoom out" disabled={status !== "ready" || transform.zoom <= 1} onClick={() => zoomTo(transform.zoom - 0.5)}>−</button>
      <button type="button" className={`${controlClass} min-w-24 text-sm`} disabled={status !== "ready"} aria-label="Reset zoom" onClick={() => zoomTo(1)}>{Math.round(transform.zoom * 100)}%</button>
      <button type="button" className={controlClass} aria-label="Zoom in" disabled={status !== "ready" || transform.zoom >= 4} onClick={() => zoomTo(transform.zoom + 0.5)}>+</button>
      <p className="w-full text-center text-xs text-stone-400">Pinch or double-tap to zoom · Drag to explore · Swipe to change photos at 100%</p>
    </div>
  </div>;
}

export default function PhotoViewer({ media, title, index, onIndexChange, onClose }: {
  media: ListingMedia[]; title: string; index: number; onIndexChange: (index: number) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const active = media[index];
  const move = (direction: number) => onIndexChange(wrapPhotoIndex(index + direction, media.length));

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    closeButton.current?.focus({ preventScroll: true });
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(<dialog ref={dialog} aria-labelledby={headingId} aria-modal="true"
    className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-stone-950 p-0 text-white backdrop:bg-black/90"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => {
      if (event.target instanceof HTMLVideoElement) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        // Keep focus in a stable control when the zoom controls remount for a new photo.
        closeButton.current?.focus({ preventScroll: true });
        move(event.key === "ArrowRight" ? 1 : -1);
      }
    }}>
    <div className="flex h-full flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1"><h2 id={headingId} className="truncate text-sm font-semibold sm:text-base">{title}</h2>
          <p role="status" aria-live="polite" aria-atomic="true" className="mt-0.5 text-xs text-stone-400">{index + 1} of {media.length}</p></div>
        <button ref={closeButton} type="button" onClick={onClose} aria-label="Close photo viewer" className={controlClass}>✕</button>
      </header>
      {active.kind === "image" ? <ZoomablePhoto key={`${active.url}-${index}`} src={active.url} title={`${title} — photo ${index + 1}`} onMove={move} /> : (
        <div className="min-h-0 flex-1"><video key={active.url} src={active.url} controls preload="metadata" className="h-full w-full object-contain" /></div>
      )}
      <footer className="flex shrink-0 items-center gap-2 border-t border-white/10 px-3 py-3 sm:px-6">
        {media.length > 1 ? <PhotoNavigationButton direction="previous" label="Previous photo" dark onClick={() => move(-1)} /> : null}
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto p-1" aria-label="Viewer photo thumbnails">
          {media.map((item, photoIndex) => <button key={`${item.url}-${photoIndex}`} type="button" aria-label={`Go to photo ${photoIndex + 1}`} aria-pressed={index === photoIndex}
            onClick={() => onIndexChange(photoIndex)} className={`h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 bg-stone-800 ${index === photoIndex ? "border-white" : "border-transparent opacity-65 hover:opacity-100"}`}>
            {item.kind === "image" ? <ListingImage src={item.url} alt="" sizes="48px" className="h-full w-full object-contain" /> : <span className="text-xs">Video</span>}
          </button>)}
        </div>
        {media.length > 1 ? <PhotoNavigationButton direction="next" label="Next photo" dark onClick={() => move(1)} /> : null}
      </footer>
    </div>
  </dialog>, document.body);
}
