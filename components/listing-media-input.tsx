"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isHeifPhoto } from "@/lib/listing-photo-format";
import { prepareListingPhoto } from "@/lib/listing-photo";
import type { ListingMedia } from "@/lib/types";

type MediaItem = {
  id: string;
  file: File;
  previewUrl: string;
};

function buildId(file: File) {
  return `${file.name}-${file.size}-${file.type}`;
}

export function ListingMediaInput({
  required = true,
  existingMedia = [],
  onProcessingChange
}: {
  required?: boolean;
  existingMedia?: ListingMedia[];
  onProcessingChange?: (processing: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const itemsRef = useRef<MediaItem[]>([]);
  const processingRef = useRef(false);
  const mountedRef = useRef(false);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    const form = inputRef.current?.form;
    // Also blocks Enter/requestSubmit before React has rendered disabled buttons.
    const guardSubmit = (event: SubmitEvent) => {
      if (processingRef.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    form?.addEventListener("submit", guardSubmit, true);
    return () => {
      mountedRef.current = false;
      form?.removeEventListener("submit", guardSubmit, true);
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  const manifest = useMemo(
    () =>
      JSON.stringify(
        items.map((item, index) => ({
          id: item.id,
          name: item.file.name,
          size: item.file.size,
          type: item.file.type,
          order: index
        }))
      ),
    [items]
  );

  function syncInputFiles(nextItems: MediaItem[]) {
    if (!inputRef.current) {
      return;
    }

    const transfer = new DataTransfer();
    for (const item of nextItems) {
      transfer.items.add(item.file);
    }
    inputRef.current.files = transfer.files;
  }

  function commitItems(nextItems: MediaItem[]) {
    syncInputFiles(nextItems);
    itemsRef.current = nextItems;
    setItems(nextItems);
  }

  async function appendFiles(fileList: FileList | null) {
    if (!fileList) return;
    if (processingRef.current) {
      syncInputFiles(itemsRef.current);
      return;
    }
    const files = Array.from(fileList);
    // Never leave raw HEIF files in the submitted input, including on failure.
    syncInputFiles(itemsRef.current);
    if (!files.length) return;
    const seen = new Set(itemsRef.current.map((item) => item.id));
    const additions = files.filter((file) => {
      const id = buildId(file);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    setError("");
    setProgress("");
    if (itemsRef.current.length + additions.length > 20) {
      setError("Upload up to 20 photos per listing. Remove a photo or choose fewer files.");
      return;
    }
    if (!additions.length) return;

    processingRef.current = true;
    setProcessing(true);
    onProcessingChange?.(true);
    try {
      const prepared: Array<{ id: string; file: File }> = [];
      // Decode one at a time to limit memory use on phones. Commit the whole
      // selection only after every photo succeeds, preserving previous photos.
      for (const [index, source] of additions.entries()) {
        setProgress(`${isHeifPhoto(source) ? "Converting to JPG" : "Preparing photo"} ${index + 1} of ${additions.length}…`);
        const file = await prepareListingPhoto(source);
        if (!mountedRef.current) return;
        prepared.push({ id: buildId(source), file });
      }
      commitItems([...itemsRef.current, ...prepared.map((item) => ({
        ...item, previewUrl: URL.createObjectURL(item.file)
      }))]);
      setProgress("Photos ready. HEIC and HEIF photos have been converted to JPG.");
    } catch (cause) {
      if (mountedRef.current) {
        setProgress("");
        setError(`${cause instanceof Error ? cause.message : "Unable to prepare these photos. Please try again."} No photos from this selection were added; your previous selection is unchanged.`);
      }
    } finally {
      if (mountedRef.current) {
        processingRef.current = false;
        setProcessing(false);
        onProcessingChange?.(false);
      }
    }
  }

  function removeItem(id: string) {
    if (processingRef.current) return;
    const removed = itemsRef.current.find((item) => item.id === id);
    commitItems(itemsRef.current.filter((item) => item.id !== id));
    if (removed) URL.revokeObjectURL(removed.previewUrl);
  }

  function moveItem(id: string, direction: -1 | 1) {
    const index = itemsRef.current.findIndex((item) => item.id === id);
    if (index >= 0) moveItemToIndex(id, index + direction);
  }

  function moveItemToIndex(id: string, targetIndex: number) {
    if (processingRef.current) return;
    const current = itemsRef.current;
    const index = current.findIndex((item) => item.id === id);
    if (index < 0 || targetIndex < 0 || targetIndex >= current.length || index === targetIndex) return;
    const nextItems = [...current];
    const [item] = nextItems.splice(index, 1);
    nextItems.splice(targetIndex, 0, item);
    commitItems(nextItems);
  }

  function reorderByDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDropTargetId(null);
      return;
    }

    const targetIndex = items.findIndex((item) => item.id === targetId);
    if (targetIndex >= 0) {
      moveItemToIndex(draggingId, targetIndex);
    }

    setDraggingId(null);
    setDropTargetId(null);
  }

  return (
    <div aria-busy={processing} className="sm:col-span-2 rounded-[1.5rem] border border-dashed border-stone-300 bg-white p-4">
      <p className="text-sm font-semibold text-stone-950">
        Listing Media
        {required ? <span className="ml-1 text-rose-700">*</span> : null}
      </p>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          appendFiles(event.dataTransfer.files);
        }}
        className="mt-4 rounded-[1.25rem] border border-stone-300 bg-stone-50 px-4 py-8 text-center"
      >
        <p className="text-sm font-medium text-stone-900">
          Drag or browse up to 20 JPG, PNG, HEIC, or HEIF files. Reorder before publishing to control buyer-facing order.
          {" HEIC and HEIF photos (up to 25 MB each) are automatically converted to JPG before upload."}
          {!required && existingMedia.length ? " Leave empty to keep current media." : ""}
        </p>
        <input
          ref={inputRef}
          name="media"
          type="file"
          multiple
          disabled={processing}
          aria-label="Listing photos"
          required={required && items.length === 0 && existingMedia.length === 0}
          accept=".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif"
          onChange={(event) => appendFiles(event.target.files)}
          className="sr-only"
        />
        <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-sm text-stone-700">
          <button
            type="button"
            disabled={processing}
            onClick={() => inputRef.current?.click()}
            className="rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Choose Files
          </button>
          <span className="text-sm text-stone-600">
            {items.length
              ? `${items.length} file${items.length === 1 ? "" : "s"} selected`
              : existingMedia.length
                ? "Choose replacement photos or keep current media"
                : "No files chosen"}
          </span>
        </div>
      </div>

      <p role="status" aria-live="polite" className="mt-3 text-sm text-stone-700">{progress}</p>
      {error ? <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p> : null}

      <input type="hidden" name="mediaManifest" value={manifest} />

      {existingMedia.length ? (
        <div className="mt-5">
          <p className="text-sm font-semibold text-stone-950">Current Listing Media</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {existingMedia.map((media, index) => (
              <article key={`${media.url}-${index}`} className="rounded-[1.25rem] border border-stone-300 p-3">
                <div className="overflow-hidden rounded-[1rem] bg-stone-100">
                  {media.kind === "video" ? (
                    <video src={media.url} className="h-36 w-full object-cover" controls />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={media.url} alt={media.originalName} className="h-36 w-full object-cover" />
                  )}
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-stone-500">Current Position {index + 1}</p>
                <p className="mt-2 line-clamp-2 text-sm font-semibold text-stone-900">{media.originalName}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {items.length ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item, index) => (
              <article
                key={item.id}
                draggable={!processing}
                onDragStart={() => setDraggingId(item.id)}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (draggingId && draggingId !== item.id) {
                    setDropTargetId(item.id);
                  }
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  if (draggingId && draggingId !== item.id) {
                    setDropTargetId(item.id);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  reorderByDrop(item.id);
                }}
                onDragEnd={() => {
                  setDraggingId(null);
                  setDropTargetId(null);
                }}
                className={`rounded-[1.25rem] border p-3 transition ${
                  dropTargetId === item.id
                    ? "border-stone-900 bg-stone-50"
                    : draggingId === item.id
                      ? "border-stone-400 bg-stone-50/70"
                      : "border-stone-300"
                }`}
              >
                <div className="overflow-hidden rounded-[1rem] bg-stone-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.previewUrl} alt={item.file.name} className="h-36 w-full object-cover" />
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-stone-500">
                  Position {index + 1} - Drag to Reorder
                </p>
                <p className="mt-2 line-clamp-2 text-sm font-semibold text-stone-900">{item.file.name}</p>
                <p className="mt-1 text-xs text-stone-600">
                  Image - {(item.file.size / 1024 / 1024).toFixed(1)} MB
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={processing || index === 0}
                    onClick={() => moveItem(item.id, -1)}
                    className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-800"
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    disabled={processing || index === items.length - 1}
                    onClick={() => moveItem(item.id, 1)}
                    className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-800"
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => removeItem(item.id)}
                    className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-800"
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 rounded-[1.25rem] bg-stone-50 p-4">
            <p className="text-sm font-semibold text-stone-950">Files queued for this listing</p>
            <div className="mt-3 grid gap-2">
              {items.map((item, index) => (
                <p key={item.id} className="text-sm text-stone-700">
                  {index + 1}. {item.file.name}
                </p>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
