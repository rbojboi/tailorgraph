import assert from "node:assert/strict";
import test from "node:test";
import { listingPhotoDimensions, resizeListingPhoto, PHOTO_PROCESSING_TIMEOUT_MS } from "@/lib/listing-photo-resize";

test("landscape, portrait and panorama are capped without cropping or upscaling", () => {
  assert.deepEqual(listingPhotoDimensions(6000, 4000), { width: 2400, height: 1600 });
  assert.deepEqual(listingPhotoDimensions(3024, 4032), { width: 1800, height: 2400 });
  assert.deepEqual(listingPhotoDimensions(12000, 1000), { width: 2400, height: 200 });
  assert.deepEqual(listingPhotoDimensions(320, 240), { width: 320, height: 240 });
  assert.deepEqual(listingPhotoDimensions(1, 10000), { width: 1, height: 2400 });
  for (const dimensions of [[0, 100], [100, -1], [NaN, 100], [1.5, 2]]) {
    assert.throws(() => listingPhotoDimensions(...dimensions as [number, number]), /invalid dimensions/);
  }
});

test("browser processing encodes bounded images, preserves PNG and releases resources on failure", async (t) => {
  let dimensions = [4000, 3000];
  let outputSize = 8;
  let decodeMode = "load";
  let drawn: unknown[] = [];
  let encodedType = "";
  let revoked = 0;
  const canvas = { width: 0, height: 0,
    getContext: () => ({ drawImage: (...args: unknown[]) => { drawn = args; } }),
    toBlob: (callback: (blob: Blob | null) => void, type: string, quality: number) => {
      encodedType = type;
      assert.equal(quality, 0.88);
      assert.ok(Math.max(canvas.width, canvas.height) <= 2400);
      callback(outputSize ? new Blob([new Uint8Array(outputSize)], { type }) : null);
    }
  };
  class FakeImage {
    naturalWidth = dimensions[0]; naturalHeight = dimensions[1];
    onload: (() => void) | null = null; onerror: (() => void) | null = null;
    set src(value: string) { if (value) queueMicrotask(() => decodeMode === "load" ? this.onload?.() : decodeMode === "error" ? this.onerror?.() : undefined); }
  }
  const globals = globalThis as unknown as Record<string, unknown>;
  const previousImage = Object.getOwnPropertyDescriptor(globalThis, "Image");
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  globals.Image = FakeImage;
  globals.document = { createElement: () => canvas };
  t.mock.method(URL, "createObjectURL", () => "blob:test");
  t.mock.method(URL, "revokeObjectURL", () => { revoked++; });
  t.after(() => {
    for (const [key, descriptor] of [["Image", previousImage], ["document", previousDocument]] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globals[key];
    }
  });
  const source = new File([new Uint8Array(10)], "large.jpeg", { type: "image/jpeg", lastModified: 123 });
  const result = await resizeListingPhoto(source);
  assert.deepEqual(drawn.slice(1), [0, 0, 2400, 1800]);
  assert.equal(result.type, "image/jpeg");
  assert.equal(result.name, "large.jpg");
  assert.equal(result.lastModified, 123);
  assert.equal(result.size, 8);
  assert.equal(canvas.width, 0);
  assert.equal(revoked, 1);
  await resizeListingPhoto(new File(["png"], "transparent.png", { type: "image/png" }));
  assert.equal(encodedType, "image/png");
  dimensions = [320, 240]; outputSize = 100;
  assert.equal(await resizeListingPhoto(source), source);
  outputSize = 0;
  await assert.rejects(resizeListingPhoto(source), /couldn't prepare/);
  decodeMode = "error";
  await assert.rejects(resizeListingPhoto(source), /couldn't prepare/);
  assert.equal(canvas.width, 0);
  assert.equal(revoked, 5);
  decodeMode = "stall";
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const rejection = assert.rejects(resizeListingPhoto(source), /couldn't prepare/);
  t.mock.timers.tick(PHOTO_PROCESSING_TIMEOUT_MS);
  await rejection;
  assert.equal(revoked, 6);
});
