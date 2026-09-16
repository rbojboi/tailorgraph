const heifMimeTypes = new Set([
  "image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"
]);

export function isHeifPhoto(file: Pick<File, "name" | "type">) {
  return heifMimeTypes.has(file.type.toLowerCase()) || /\.hei[cf]$/i.test(file.name);
}
