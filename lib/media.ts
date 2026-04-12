import { mkdir, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { randomUUID } from "node:crypto";
import type { ListingMedia } from "@/lib/types";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif"
]);

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function saveListingMediaFiles(
  sellerId: string,
  files: File[]
): Promise<ListingMedia[]> {
  const validFiles = files.filter((file) => file.size > 0);

  if (validFiles.length > 20) {
    throw new Error("Upload up to 20 files per listing.");
  }

  for (const file of validFiles) {
    if (!allowedMimeTypes.has(file.type)) {
      throw new Error("Only JPG, PNG, HEIC, and HEIF uploads are supported right now.");
    }
  }

  const targetDir = `public/uploads/listings/${sellerId}`;
  await mkdir(targetDir, { recursive: true });

  const media: ListingMedia[] = [];

  for (const file of validFiles) {
    const extension =
      extname(file.name) ||
      (file.type === "image/png"
        ? ".png"
        : file.type === "image/heic"
          ? ".heic"
          : file.type === "image/heif"
            ? ".heif"
            : ".jpg");
    const filename = `${randomUUID()}-${safeName(file.name || `upload${extension}`)}`;
    const outputPath = `${targetDir}/${filename}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(outputPath, buffer);

    media.push({
      url: `/uploads/listings/${sellerId}/${filename}`,
      kind: "image",
      originalName: file.name,
      mimeType: file.type
    });
  }

  return media;
}
