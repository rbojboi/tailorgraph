import { uploadListingPhoto } from "@/lib/listing-upload";
import type { UploadedListingPhoto } from "@/lib/listing-upload-policy";

export type QueuedListingPhoto = {
  id: string;
  file: File;
  previewUrl: string;
  uploaded?: UploadedListingPhoto;
  error?: string;
  percentage?: number;
};

export async function uploadPendingPhotos(
  sellerId: string,
  photos: QueuedListingPhoto[],
  onUpdate: (photos: QueuedListingPhoto[]) => void,
  onProgress: (message: string) => void,
  signal: AbortSignal,
  uploader = uploadListingPhoto
) {
  let next = photos;
  const pending = photos.filter((photo) => !photo.uploaded);
  // One photo at a time bounds memory/connection pressure on mobile. The Blob
  // SDK handles multipart chunk retries; successful photos are never resent.
  for (const [index, photo] of pending.entries()) {
    if (signal.aborted) break;
    const update = (change: Partial<QueuedListingPhoto>) => {
      next = next.map((item) => item.id === photo.id ? { ...item, ...change } : item);
      if (!signal.aborted) onUpdate(next);
    };
    update({ error: undefined, percentage: 0 });
    onProgress(`Uploading photo ${index + 1} of ${pending.length}…`);
    try {
      const uploaded = await uploader(sellerId, photo.file, (percentage) => {
        update({ percentage: Math.max(0, Math.min(100, Math.round(percentage))) });
      }, AbortSignal.any([signal, AbortSignal.timeout(180_000)]));
      update({ uploaded, percentage: 100 });
    } catch {
      if (signal.aborted) break;
      update({ error: "Upload failed. Check your connection and retry, or remove this photo." });
    }
  }
  return next;
}
