export const MAX_LISTING_PHOTOS = 20;
export const MAX_LISTING_PHOTO_BYTES = 25 * 1024 * 1024;
export const MAX_UPLOAD_MANIFEST_LENGTH = 16_000;
export const LISTING_UPLOAD_ENDPOINT = "/api/listing-media/upload";

export type UploadedListingPhoto = {
  pathname: string;
  originalName: string;
};

export function photoContentType(type: string) {
  return type === "image/jpg" ? "image/jpeg" : type;
}

export function validatePhotoSize(size: number) {
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_LISTING_PHOTO_BYTES) {
    throw new Error("Each photo must be between 1 byte and 25 MB. Export a smaller photo and try again.");
  }
}

export function validatePhotoType(type: string) {
  if (type !== "image/jpeg" && type !== "image/png") {
    throw new Error("Only JPG and PNG can be uploaded. HEIC/HEIF must finish converting first.");
  }
}

export function validatePhotoName(name: unknown): asserts name is string {
  if (typeof name !== "string" || !name.trim() || name.length > 255 || /[\u0000-\u001f]/.test(name)) {
    throw new Error("Invalid photo filename.");
  }
}

export function validateUploadPath(pathname: unknown, sellerId: string): asserts pathname is string {
  const prefix = `listings/${sellerId}/direct/`;
  if (typeof pathname !== "string" || !pathname.startsWith(prefix) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$/.test(pathname.slice(prefix.length))) {
    throw new Error("Invalid photo upload path for this seller.");
  }
}

export function parseUploadedPhotos(raw: unknown, sellerId: string): UploadedListingPhoto[] {
  if (typeof raw !== "string" || raw.length > MAX_UPLOAD_MANIFEST_LENGTH) {
    throw new Error("Invalid photo upload manifest.");
  }
  let entries: unknown;
  try { entries = JSON.parse(raw); } catch { throw new Error("Invalid photo upload manifest."); }
  if (!Array.isArray(entries) || entries.length > MAX_LISTING_PHOTOS) {
    throw new Error("Upload up to 20 photos per listing.");
  }
  const seen = new Set<string>();
  return entries.map((entry: unknown) => {
    if (!entry || typeof entry !== "object") throw new Error("Invalid photo upload manifest.");
    const { pathname, originalName } = entry as Record<string, unknown>;
    validateUploadPath(pathname, sellerId);
    validatePhotoName(originalName);
    if (seen.has(pathname)) throw new Error("Duplicate photo in upload manifest.");
    seen.add(pathname);
    return { pathname, originalName };
  });
}
