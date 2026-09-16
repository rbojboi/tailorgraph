import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

const uploads = [];
mock.module("@vercel/blob", { namedExports: { put: async (path, file, options) => {
  uploads.push({ path, file, options });
  return { url: `https://example.public.blob.vercel-storage.com/${path}` };
} } });
const { saveListingMediaFiles } = await import("../lib/media.ts");
const { prepareListingPhoto } = await import("../lib/listing-photo.ts");
let savedToken;
beforeEach(() => {
  savedToken = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_READ_WRITE_TOKEN = "test_not_a_real_token";
  uploads.length = 0;
});
afterEach(() => {
  if (savedToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
  else process.env.BLOB_READ_WRITE_TOKEN = savedToken;
});

test("converted HEIF is stored as JPEG with correct bytes, filename and Blob content type", async () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const converted = await prepareListingPhoto(new File(["heif"], "shirt.HEIF"), async () => new Blob([bytes], { type: "image/jpeg" }));
  const [media] = await saveListingMediaFiles("seller-test", [converted]);
  assert.equal(uploads.length, 1);
  assert.match(uploads[0].path, /^listings\/seller-test\/.*-shirt\.jpg$/);
  assert.equal(uploads[0].options.contentType, "image/jpeg");
  assert.deepEqual(new Uint8Array(await uploads[0].file.arrayBuffer()), bytes);
  assert.equal(media.originalName, "shirt.jpg");
  assert.equal(media.mimeType, "image/jpeg");
  assert.equal(media.kind, "image");
});

test("server rejects unconverted HEIF before writing any file from a batch", async () => {
  for (const [name, type] of [["photo.HEIC", ""], ["photo.heif", "image/heif"], ["photo", "image/heic-sequence"]]) {
    await assert.rejects(saveListingMediaFiles("seller-test", [
      new File(["jpeg"], "ok.jpg", { type: "image/jpeg" }), new File(["heif"], name, { type })
    ]), /finish converting to JPG/);
  }
  assert.equal(uploads.length, 0);
});

test("mixed JPEG/PNG uploads retain order and the existing media metadata contract", async () => {
  const media = await saveListingMediaFiles("seller-test", [
    new File(["png"], "detail.png", { type: "image/png" }),
    new File(["jpg"], "cover.jpg", { type: "image/jpeg" })
  ]);
  assert.deepEqual(media.map((item) => item.originalName), ["detail.png", "cover.jpg"]);
  assert.deepEqual(uploads.map((upload) => upload.options.contentType), ["image/png", "image/jpeg"]);
});
