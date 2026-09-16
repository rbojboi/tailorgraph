import assert from "node:assert/strict";
import test from "node:test";
import { MAX_LISTING_PHOTO_BYTES, parseUploadedPhotos, validatePhotoSize, validateUploadPath } from "@/lib/listing-upload-policy";

const path = "listings/seller-a/direct/11111111-1111-4111-8111-111111111111.jpg";

test("photo manifest preserves order and contains references only", () => {
  const entries = [{ pathname: path, originalName: "first.jpg" }, { pathname: path.replace("11111111.jpg", "22222222.png"), originalName: "second.png" }];
  assert.deepEqual(parseUploadedPhotos(JSON.stringify(entries), "seller-a"), entries);
});

test("upload paths reject other sellers, traversal, URLs and unsupported extensions", () => {
  validateUploadPath(path, "seller-a");
  for (const invalid of [path.replace("seller-a", "seller-b"), path + "/../a", path + "?x=1", "https://example.com/" + path, path.replace(".jpg", ".heic"), path.replace("direct/", "direct/../")]) {
    assert.throws(() => validateUploadPath(invalid, "seller-a"), /Invalid photo upload path/);
  }
});

test("photo manifests reject malformed data, duplicate references and over-20 batches", () => {
  const photo = { pathname: path, originalName: "cover.jpg" };
  for (const raw of ["{", "null", "{}", JSON.stringify([photo, photo]), JSON.stringify(Array(21).fill(photo)), JSON.stringify([{ ...photo, originalName: "" }]), " ".repeat(16_001)]) {
    assert.throws(() => parseUploadedPhotos(raw, "seller-a"));
  }
});

test("25 MB per-photo boundary is enforced without a small total batch cap", () => {
  validatePhotoSize(MAX_LISTING_PHOTO_BYTES);
  validatePhotoSize(8 * 1024 * 1024);
  for (const size of [0, -1, NaN, Infinity, 1.5, MAX_LISTING_PHOTO_BYTES + 1]) assert.throws(() => validatePhotoSize(size));
});
