"use client";

import { useMemo, useRef, useState } from "react";
import type { ListingMedia } from "@/lib/types";

type MediaItem = {
  id: string;
  file: File;
  previewUrl: string;
};

function buildId(file: File) {
  return `${file.name}-${file.size}-${file.type}`;
}

function mediaTypeLabel(file: File) {
  return "Image";
}

export function ListingMediaInput({
  required = true,
  existingMedia = []
}: {
  required?: boolean;
  existingMedia?: ListingMedia[];
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  function isAllowedFileType(file: File) {
    return ["image/jpeg", "image/jpg", "image/png", "image/heic", "image/heif"].includes(file.type);
  }

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

  function appendFiles(fileList: FileList | null) {
    if (!fileList) {
      return;
    }

    setItems((current) => {
      const existingIds = new Set(current.map((item) => item.id));
      const additions = Array.from(fileList)
        .filter((file) => file.size > 0 && isAllowedFileType(file))
        .map((file) => ({
          id: buildId(file),
          file,
          previewUrl: URL.createObjectURL(file)
        }))
        .filter((item) => !existingIds.has(item.id));

      const nextItems = [...current, ...additions].slice(0, 20);
      syncInputFiles(nextItems);
      return nextItems;
    });
  }

  function removeItem(id: string) {
    setItems((current) => {
      const nextItems = current.filter((item) => item.id !== id);
      syncInputFiles(nextItems);
      return nextItems;
    });
  }

  function moveItem(id: string, direction: -1 | 1) {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const nextItems = [...current];
      const [item] = nextItems.splice(index, 1);
      nextItems.splice(nextIndex, 0, item);
      syncInputFiles(nextItems);
      return nextItems;
    });
  }

  function moveItemToIndex(id: string, targetIndex: number) {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id);

      if (index < 0 || targetIndex < 0 || targetIndex >= current.length || index === targetIndex) {
        return current;
      }

      const nextItems = [...current];
      const [item] = nextItems.splice(index, 1);
      nextItems.splice(targetIndex, 0, item);
      syncInputFiles(nextItems);
      return nextItems;
    });
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
    <div className="sm:col-span-2 rounded-[1.5rem] border border-dashed border-stone-300 bg-white p-4">
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
          {!required && existingMedia.length ? " Leave empty to keep current media." : ""}
        </p>
        <input
          ref={inputRef}
          name="media"
          type="file"
          multiple
          required={required && items.length === 0 && existingMedia.length === 0}
          accept=".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif"
          onChange={(event) => appendFiles(event.target.files)}
          className="sr-only"
        />
        <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-sm text-stone-700">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Choose Files
          </button>
          <span className="text-sm text-stone-600">
            {items.length
              ? `${items.length} file${items.length === 1 ? "" : "s"} selected`
              : existingMedia.length
                ? "Add more files or leave current media as is"
                : "No files chosen"}
          </span>
        </div>
      </div>

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
                draggable
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
                  {mediaTypeLabel(item.file)} - {(item.file.size / 1024 / 1024).toFixed(1)} MB
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => moveItem(item.id, -1)}
                    className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-800"
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(item.id, 1)}
                    className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-800"
                  >
                    Move down
                  </button>
                  <button
                    type="button"
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
