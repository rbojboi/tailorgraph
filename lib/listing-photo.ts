import { isHeifPhoto } from "@/lib/listing-photo-format";

export const MAX_HEIF_BYTES = 25 * 1024 * 1024;
export const HEIF_CONVERSION_TIMEOUT_MS = 60_000;

type JpegConverter = (file: File) => Promise<Blob>;

async function convertHeifToJpeg(file: File): Promise<Blob> {
  const { heicTo } = await import("heic-to/csp");
  return heicTo({ blob: file, type: "image/jpeg", quality: 0.9 });
}

export async function prepareListingPhoto(
  file: File,
  convert: JpegConverter = convertHeifToJpeg
): Promise<File> {
  if (!file.size) {
    throw new Error(`${file.name}: this photo is empty. Choose another file.`);
  }

  if (isHeifPhoto(file)) {
    if (file.size > MAX_HEIF_BYTES) {
      throw new Error(`${file.name}: HEIC/HEIF photos must be 25 MB or smaller. Export a smaller JPG and try again.`);
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const jpeg = await Promise.race([
        convert(file),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Conversion timed out.")), HEIF_CONVERSION_TIMEOUT_MS);
        })
      ]);
      const signature = new Uint8Array(await jpeg.slice(0, 3).arrayBuffer());
      if (jpeg.type !== "image/jpeg" || signature[0] !== 0xff || signature[1] !== 0xd8 || signature[2] !== 0xff) {
        throw new Error("The converter did not produce a JPEG.");
      }
      const stem = file.name.replace(/\.[^.]+$/, "") || "photo";
      return new File([jpeg], `${stem}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
    } catch {
      throw new Error(`${file.name}: we couldn't convert this photo. Try again, or export it as a JPG or PNG and upload that instead.`);
    } finally {
      clearTimeout(timer);
    }
  }

  const type = file.type.toLowerCase();
  if (["image/jpeg", "image/jpg", "image/png"].includes(type)) {
    return file;
  }
  // Some browsers omit the MIME type for files selected from disk.
  if (!type || type === "application/octet-stream") {
    const inferredType = /\.jpe?g$/i.test(file.name) ? "image/jpeg" : /\.png$/i.test(file.name) ? "image/png" : null;
    if (inferredType) {
      return new File([file], file.name, { type: inferredType, lastModified: file.lastModified });
    }
  }
  throw new Error(`${file.name}: choose a JPG, PNG, HEIC, or HEIF photo.`);
}
