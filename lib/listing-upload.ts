import { upload } from "@vercel/blob/client";
import {
  LISTING_UPLOAD_ENDPOINT, photoContentType, validatePhotoName, validatePhotoSize,
  validatePhotoType, type UploadedListingPhoto
} from "@/lib/listing-upload-policy";

// Fresh immutable path on each attempt: a lost response cannot cause an overwrite.
export async function uploadListingPhoto(
  sellerId: string,
  file: File,
  onProgress: (percentage: number) => void,
  signal: AbortSignal
): Promise<UploadedListingPhoto> {
  validatePhotoName(file.name);
  validatePhotoSize(file.size);
  const contentType = photoContentType(file.type);
  validatePhotoType(contentType);
  const pathname = `listings/${sellerId}/direct/${crypto.randomUUID()}.${contentType === "image/png" ? "png" : "jpg"}`;
  const blob = await upload(pathname, file, {
    access: "public",
    handleUploadUrl: LISTING_UPLOAD_ENDPOINT,
    contentType,
    clientPayload: JSON.stringify({ size: file.size, contentType }),
    multipart: true,
    abortSignal: signal,
    onUploadProgress: ({ percentage }) => onProgress(percentage)
  });
  if (blob.pathname !== pathname || blob.contentType !== contentType) {
    throw new Error("Storage returned unexpected photo details. Retry this photo.");
  }
  return { pathname, originalName: file.name };
}
