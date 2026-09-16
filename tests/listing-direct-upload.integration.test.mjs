import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const seller = "11111111-1111-4111-8111-111111111111";
const path = `listings/${seller}/direct/22222222-2222-4222-8222-222222222222.jpg`;
const blobUrl = (pathname) => `https://test.public.blob.vercel-storage.com/${pathname}`;
const reads = [];
const uploads = [];
let metadata = {};
let user;
let tokenOptions;
mock.module("@vercel/blob", { namedExports: { head: async (pathname) => {
  reads.push(pathname);
  if (metadata.missing) throw new Error("Blob not found");
  return { url: blobUrl(pathname), pathname, size: 8 * 1024 * 1024, contentType: "image/jpeg", ...metadata };
} } });
mock.module("@vercel/blob/client", { namedExports: {
  upload: async (pathname, file, options) => {
    uploads.push({ pathname, file, options });
    options.onUploadProgress({ percentage: 55 });
    return { pathname, contentType: options.contentType, url: blobUrl(pathname) };
  },
  handleUpload: async ({ body, onBeforeGenerateToken }) => {
    tokenOptions = await onBeforeGenerateToken(body.payload.pathname, body.payload.clientPayload, body.payload.multipart);
    return { type: "blob.generate-client-token", clientToken: "mock-scoped-token" };
  }
} });
mock.module("../lib/auth.ts", { namedExports: { getCurrentUser: async () => user } });
const { resolveUploadedListingMedia, resolveListingFormMedia, verifyWarningListingMedia } = await import("../lib/listing-upload-server.ts");
const { uploadListingPhoto } = await import("../lib/listing-upload.ts");
const { uploadPendingPhotos } = await import("../lib/listing-upload-queue.ts");
const { POST } = await import("../app/api/listing-media/upload/route.ts");

beforeEach(() => {
  user = { id: seller, role: "seller" };
  metadata = {};
  tokenOptions = undefined;
  reads.length = 0;
  uploads.length = 0;
  process.env.BLOB_READ_WRITE_TOKEN = "mock-token-not-valid";
});
const manifest = (pathname = path) => JSON.stringify([{ pathname, originalName: "cover.jpg" }]);
const request = (overrides = {}, headers = {}) => new Request("https://tailorgraph.test/api/listing-media/upload", {
  method: "POST",
  headers: { origin: "https://tailorgraph.test", "content-type": "application/json", ...headers },
  body: JSON.stringify({ type: "blob.generate-client-token", payload: { pathname: path, multipart: true,
    clientPayload: JSON.stringify({ contentType: "image/jpeg", size: 8 * 1024 * 1024 }) }, ...overrides })
});

test("8 MB photo uploads via multipart directly to Blob, with progress and no raw-file server action", async () => {
  const file = new File([new Uint8Array(8 * 1024 * 1024)], "large.jpg", { type: "image/jpeg" });
  const progress = [];
  const uploaded = await uploadListingPhoto(seller, file, (value) => progress.push(value), new AbortController().signal);
  assert.equal(uploads[0].file, file);
  assert.equal(uploads[0].options.multipart, true);
  assert.equal(uploads[0].options.handleUploadUrl, "/api/listing-media/upload");
  assert.deepEqual(progress, [55]);
  assert.match(uploaded.pathname, new RegExp(`^listings/${seller}/direct/.*\\.jpg$`));
  const form = new FormData();
  form.set("uploadedMedia", JSON.stringify([uploaded]));
  assert.ok((await new Response(form).arrayBuffer()).byteLength < 1000);
  assert.equal(form.getAll("media").length, 0);
});

test("token endpoint authenticates seller, checks origin and scopes immutable type/size/path with expiry", async () => {
  const before = Date.now();
  assert.equal((await POST(request())).status, 200);
  assert.deepEqual(tokenOptions.allowedContentTypes, ["image/jpeg"]);
  assert.equal(tokenOptions.maximumSizeInBytes, 8 * 1024 * 1024);
  assert.equal(tokenOptions.allowOverwrite, false);
  assert.equal(tokenOptions.addRandomSuffix, false);
  assert.ok(tokenOptions.validUntil >= before + 14 * 60_000 && tokenOptions.validUntil <= Date.now() + 15 * 60_000);
  user = null;
  assert.equal((await POST(request())).status, 401);
  user = { id: seller, role: "buyer" };
  assert.equal((await POST(request())).status, 403);
  user = { id: seller, role: "seller" };
  assert.equal((await POST(request({}, { origin: "https://evil.test" }))).status, 403);
  assert.equal((await POST(request({}, { origin: "null" }))).status, 403);
});

test("token endpoint rejects cross-seller paths, oversized files, MIME mismatch and spoofed callbacks", async () => {
  for (const [pathname, contentType, size] of [
    [path.replace(seller, "other-seller"), "image/jpeg", 100],
    [path, "image/jpeg", 25 * 1024 * 1024 + 1],
    [path, "image/png", 100], [path, "image/heic", 100], [path, "text/html", 100]
  ]) {
    assert.equal((await POST(request({ payload: { pathname, multipart: true, clientPayload: JSON.stringify({ contentType, size }) } }))).status, 400);
  }
  assert.equal((await POST(request({ type: "blob.upload-completed" }))).status, 400);
  delete process.env.BLOB_READ_WRITE_TOKEN;
  assert.equal((await POST(request())).status, 503);
});

test("listing save uses authenticated storage metadata, verifies ownership before HEAD and preserves photo order", async () => {
  const second = path.replace("22222222.jpg", "33333333.jpg");
  const entries = [{ pathname: second, originalName: "second.jpg" }, { pathname: path, originalName: "first.jpg" }];
  const result = await resolveUploadedListingMedia(seller, JSON.stringify(entries));
  assert.deepEqual(reads, [second, path]);
  assert.deepEqual(result.map((item) => item.originalName), ["second.jpg", "first.jpg"]);
  assert.equal(result[0].url, blobUrl(second));
  reads.length = 0;
  await assert.rejects(resolveUploadedListingMedia("other-seller", manifest()), /Invalid photo upload path/);
  assert.equal(reads.length, 0);
});

test("listing save rejects missing, oversized or incompatible stored objects and old raw file payloads", async () => {
  for (const invalid of [{ missing: true }, { size: 0 }, { size: 30 * 1024 * 1024 }, { contentType: "text/html" }, { contentType: "image/png" }, { pathname: "wrong" }]) {
    metadata = invalid;
    await assert.rejects(resolveUploadedListingMedia(seller, manifest()));
  }
  const form = new FormData();
  form.set("media", new File(["photo"], "photo.jpg"));
  await assert.rejects(resolveListingFormMedia(seller, form), /Refresh/);
  assert.deepEqual(await resolveListingFormMedia(seller, new FormData()), []);
});

test("measurement overrides reverify new photos and allow only exact unchanged existing media", async () => {
  const photo = { url: blobUrl(path), kind: "image", mimeType: "image/jpeg", originalName: "cover.jpg" };
  assert.deepEqual(await verifyWarningListingMedia(seller, encodeURIComponent(JSON.stringify([photo]))), [photo]);
  for (const url of ["https://evil.test/" + path, blobUrl(path).replace("test.public", "foreign.public"), blobUrl(path).replace(seller, "other-seller"), blobUrl(path) + "?x=1"]) {
    await assert.rejects(verifyWarningListingMedia(seller, JSON.stringify([{ ...photo, url }])));
  }
  const legacy = { ...photo, url: "/uploads/listings/legacy.png" };
  assert.deepEqual(await verifyWarningListingMedia(seller, JSON.stringify([legacy]), [legacy]), [legacy]);
  await assert.rejects(verifyWarningListingMedia(seller, JSON.stringify([{ ...legacy, originalName: "changed" }]), [legacy]));
});

test("failed batch retains successes; retry only resends failures and reordering keeps references", async () => {
  const a = { id: "a", file: new File(["a"], "a.jpg"), previewUrl: "blob:a" };
  const b = { id: "b", file: new File(["b"], "b.jpg"), previewUrl: "blob:b" };
  const controller = new AbortController();
  let queue = [a, b];
  const attempted = [];
  const uploader = async (_, file, progress) => {
    attempted.push(file.name);
    progress(50);
    if (file.name === "b.jpg") throw new Error("Disconnected");
    return { pathname: path, originalName: file.name };
  };
  queue = await uploadPendingPhotos(seller, queue, () => {}, () => {}, controller.signal, uploader);
  assert.ok(queue[0].uploaded);
  assert.match(queue[1].error, /retry/);
  assert.deepEqual(attempted, ["a.jpg", "b.jpg"]);
  queue.reverse();
  attempted.length = 0;
  queue = await uploadPendingPhotos(seller, queue, () => {}, () => {}, controller.signal, async (_, file) => {
    attempted.push(file.name); return { pathname: path.replace("22222222.jpg", "33333333.jpg"), originalName: file.name };
  });
  assert.deepEqual(attempted, ["b.jpg"]);
  assert.deepEqual(queue.map((item) => item.uploaded.originalName), ["b.jpg", "a.jpg"]);
  assert.ok(queue.every((item) => !item.error));
});

test("unmount cancellation stops remaining uploads and state updates", async () => {
  const controller = new AbortController();
  controller.abort();
  let called = false;
  await uploadPendingPhotos(seller, [{ id: "a", file: new File(["a"], "a.jpg"), previewUrl: "blob:a" }], () => { called = true; }, () => {}, controller.signal, async () => { called = true; });
  assert.equal(called, false);
});
