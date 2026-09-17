export const LISTING_PHOTO_MAX_EDGE = 2400;
export const LISTING_PHOTO_JPEG_QUALITY = 0.88;
export const PHOTO_PROCESSING_TIMEOUT_MS = 30_000;

export function listingPhotoDimensions(width: number, height: number) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new Error("The photo has invalid dimensions.");
  }
  const scale = Math.min(1, LISTING_PHOTO_MAX_EDGE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// Browser decoding applies EXIF orientation before drawing. Re-encoding removes
// the old orientation tag, so portrait phone photos are not rotated twice.
export async function resizeListingPhoto(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  const canvas = document.createElement("canvas");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("Photo decoding timed out.")), PHOTO_PROCESSING_TIMEOUT_MS);
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to decode photo."));
      image.src = url;
    });
    clearTimeout(timer);
    const { width, height } = listingPhotoDimensions(image.naturalWidth, image.naturalHeight);
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);
    // Preserve transparent PNGs. Responsive delivery can still serve WebP.
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    const output = await new Promise<Blob>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("Photo encoding timed out.")), PHOTO_PROCESSING_TIMEOUT_MS);
      canvas.toBlob((blob) => blob?.size && blob.type === type
        ? resolve(blob) : reject(new Error("Unable to encode photo.")), type, LISTING_PHOTO_JPEG_QUALITY);
    });
    // Do not enlarge or degrade an already-small, efficiently encoded image.
    if (width === image.naturalWidth && height === image.naturalHeight && output.size >= file.size) return file;
    const stem = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([output], `${stem}.${type === "image/png" ? "png" : "jpg"}`, { type, lastModified: file.lastModified });
  } catch {
    throw new Error(`${file.name}: we couldn't prepare this photo. Try a smaller image or export it as a JPG or PNG.`);
  } finally {
    clearTimeout(timer);
    image.onload = null;
    image.onerror = null;
    image.src = "";
    URL.revokeObjectURL(url);
    canvas.width = 0;
    canvas.height = 0;
  }
}
