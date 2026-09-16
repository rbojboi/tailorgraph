import assert from "node:assert/strict";
import test from "node:test";
import { isHeifPhoto } from "@/lib/listing-photo-format";
import { HEIF_CONVERSION_TIMEOUT_MS, MAX_HEIF_BYTES, prepareListingPhoto } from "@/lib/listing-photo";

const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 1]);
const jpeg = () => new Blob([jpegBytes], { type: "image/jpeg" });
const unexpectedConversion = async () => { throw new Error("Must not load the decoder"); };

test("HEIF detection accepts case-insensitive extensions, missing MIME and sequence MIME types", () => {
  for (const file of [
    { name: "IMG.HEIC", type: "" }, { name: "photo.heif", type: "application/octet-stream" },
    { name: "photo", type: "image/heic" }, { name: "photo", type: "image/heif" },
    { name: "photo", type: "image/heic-sequence" }, { name: "photo", type: "image/heif-sequence" }
  ]) assert.equal(isHeifPhoto(file), true);
  assert.equal(isHeifPhoto({ name: "photo.jpg", type: "image/jpeg" }), false);
});

test("HEIC and HEIF become actual JPEG files with matching extension, MIME, bytes and timestamp", async () => {
  for (const name of ["IMG.HEIC", "suit.detail.heif", "photo"]) {
    const source = new File(["heif"], name, { type: "image/heif", lastModified: 1234 });
    const output = await prepareListingPhoto(source, async (input) => {
      assert.equal(input, source);
      return jpeg();
    });
    assert.equal(output.name, name === "suit.detail.heif" ? "suit.detail.jpg" : name === "photo" ? "photo.jpg" : "IMG.jpg");
    assert.equal(output.type, "image/jpeg");
    assert.equal(output.lastModified, 1234);
    assert.deepEqual(new Uint8Array(await output.arrayBuffer()), jpegBytes);
  }
});

test("JPG and PNG pass through unchanged without invoking a decoder", async () => {
  for (const type of ["image/jpeg", "image/jpg", "image/png"]) {
    const source = new File(["photo"], "photo", { type });
    assert.equal(await prepareListingPhoto(source, unexpectedConversion), source);
  }
});

test("missing JPEG/PNG MIME is normalized without altering bytes", async () => {
  for (const [name, mime] of [["photo.JPEG", "image/jpeg"], ["photo.PNG", "image/png"]]) {
    const output = await prepareListingPhoto(new File(["photo"], name), unexpectedConversion);
    assert.equal(output.type, mime);
    assert.equal(await output.text(), "photo");
  }
});

test("empty and unsupported selections are rejected with actionable errors", async () => {
  await assert.rejects(prepareListingPhoto(new File([], "empty.heic"), unexpectedConversion), /empty/);
  await assert.rejects(prepareListingPhoto(new File(["gif"], "photo.gif", { type: "image/gif" }), unexpectedConversion), /choose a JPG, PNG, HEIC, or HEIF/);
});

test("oversized HEIF is rejected before loading the decoder", async () => {
  const source = new File([new Uint8Array(MAX_HEIF_BYTES + 1)], "large.heic");
  await assert.rejects(prepareListingPhoto(source, unexpectedConversion), /25 MB or smaller/);
});

test("decoder failure and invalid output do not return the original HEIF", async () => {
  const source = new File(["heif"], "broken.heic");
  for (const convert of [
    async () => { throw new Error("decoder failed"); },
    async () => new Blob([], { type: "image/jpeg" }),
    async () => new Blob(["not a JPEG"], { type: "image/jpeg" }),
    async () => new Blob([jpegBytes], { type: "image/png" })
  ]) await assert.rejects(prepareListingPhoto(source, convert), /broken.heic: we couldn't convert.*export it as a JPG or PNG/);
});

test("a stalled decoder times out so the seller is not stuck indefinitely", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const conversion = prepareListingPhoto(new File(["heif"], "slow.heif"), () => new Promise<Blob>(() => {}));
  const rejection = assert.rejects(conversion, /we couldn't convert/);
  context.mock.timers.tick(HEIF_CONVERSION_TIMEOUT_MS);
  await rejection;
});
