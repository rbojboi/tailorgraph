import { head } from "@vercel/blob";
import type { ListingMedia } from "@/lib/types";
import {
  MAX_LISTING_PHOTOS, MAX_UPLOAD_MANIFEST_LENGTH, parseUploadedPhotos,
  validatePhotoSize, validatePhotoType
} from "@/lib/listing-upload-policy";

export async function resolveUploadedListingMedia(sellerId: string, raw: unknown): Promise<ListingMedia[]> {
  const photos = parseUploadedPhotos(raw, sellerId);
  // Do not accept caller-provided URLs or MIME types. Read metadata from this
  // project's authenticated Blob store, using only validated seller-owned paths.
  const media: ListingMedia[] = [];
  const signal = AbortSignal.timeout(15_000);
  for (let offset = 0; offset < photos.length; offset += 4) {
    const batch = await Promise.all(photos.slice(offset, offset + 4).map(async (photo): Promise<ListingMedia> => {
      const blob = await head(photo.pathname, { abortSignal: signal });
      validatePhotoSize(blob.size);
      validatePhotoType(blob.contentType);
      if (blob.pathname !== photo.pathname ||
          (photo.pathname.endsWith(".png") ? "image/png" : "image/jpeg") !== blob.contentType) {
        throw new Error("Stored photo does not match the upload. Re-select it and try again.");
      }
      return { url: blob.url, kind: "image", originalName: photo.originalName, mimeType: blob.contentType };
    }));
    media.push(...batch);
  }
  return media;
}

export async function resolveListingFormMedia(sellerId: string, formData: FormData) {
  if (formData.getAll("media").some((entry) => entry instanceof File && entry.size > 0)) {
    throw new Error("The photo uploader has changed. Refresh this page and re-select your photos.");
  }
  return resolveUploadedListingMedia(sellerId, formData.get("uploadedMedia") ?? "[]");
}

// Measurement-warning overrides must not become an alternate way to attach an
// arbitrary URL or another seller's photo. Existing unchanged media is allowed.
export async function verifyWarningListingMedia(sellerId: string, raw: string, existing: ListingMedia[] = []) {
  if (raw.length > MAX_UPLOAD_MANIFEST_LENGTH * 3) throw new Error("Invalid listing photos.");
  const photos: unknown = JSON.parse(decodeURIComponent(raw));
  if (!Array.isArray(photos) || photos.length > MAX_LISTING_PHOTOS) throw new Error("Invalid listing photos.");
  const result: ListingMedia[] = [];
  for (const photo of photos) {
    if (!photo || typeof photo !== "object") throw new Error("Invalid listing photos.");
    const unchanged = existing.find((item) => item.url === photo.url && item.kind === photo.kind &&
      item.originalName === photo.originalName && item.mimeType === photo.mimeType);
    if (unchanged) { result.push(unchanged); continue; }
    const url = new URL(photo.url);
    if (url.protocol !== "https:" || !/^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/.test(url.hostname) ||
        url.search || url.hash || url.username || url.password || url.port) throw new Error("Invalid listing photo URL.");
    const [verified] = await resolveUploadedListingMedia(sellerId, JSON.stringify([
      { pathname: url.pathname.slice(1), originalName: photo.originalName }
    ]));
    if (verified.url !== photo.url) throw new Error("Photo is not in this project's storage.");
    result.push(verified);
  }
  if (new Set(result.map((photo) => photo.url)).size !== result.length) throw new Error("Duplicate listing photos.");
  return result;
}
