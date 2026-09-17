# Direct seller photo uploads

Listing photos now go from the browser directly to Vercel Blob using the
installed `@vercel/blob/client` multipart uploader. The listing Server Action
receives a small ordered `uploadedMedia` JSON manifest, never the image bytes.
This removes Vercel Functions' 4.5 MB request cap from the photo transport.

## Seller experience

- Up to 20 photos, each at most 25 MiB (before and after HEIC conversion).
- Photos are resized to at most 2,400 pixels on the longest edge before upload;
  JPEGs use quality 0.88 and PNGs preserve transparency. HEIC/HEIF conversion runs
  first. See `listing-photo-optimization.md` for details and verification.
- Conversion/optimization runs before upload. Photos upload automatically on selection.
- One photo uploads at a time, with percentage progress. The Blob SDK retries
  failed multipart chunks. Pause stops the current request and remaining queue.
- Failed/paused photos stay visible. Retry sends only unfinished photos; already
  completed photos remain uploaded. Remove discards a selected photo reference.
- Draft, publish, override and Enter/requestSubmit are blocked until all selected
  photos finish. Reordering changes manifest order without uploading again.
- Editing without replacement photos preserves existing media. Selecting photos
  continues to replace the entire media set, not append to existing media.
- Old already-open multipart forms receive an instruction to refresh/reselect.

## Security and persistence

`POST /api/listing-media/upload` requires a same-origin JSON request and an
authenticated seller. Each short-lived (15-minute) token is scoped to one unique
seller-owned path, the precise JPEG/PNG type and a maximum byte count. Overwriting
is prohibited; neither the read-write token nor other provider secrets enter the
client bundle. No upload-completion webhook is required.

At listing save, the server validates at most 20 unique seller-owned paths and
reads their metadata via authenticated Blob `head(pathname)`. It uses storage's
canonical URL/type, not a URL supplied by the browser. Missing objects, wrong
types/sizes and cross-seller paths fail before the listing is written. Reads run
in groups of four with an overall 15-second timeout and preserve submitted order.
Measurement-warning overrides also reverify new media; unchanged existing media
is accepted only when it exactly matches the authenticated seller's listing.

## Rollout

No schema migration, package change or new environment variable is required.
`BLOB_READ_WRITE_TOKEN` must be configured (already used by existing uploads).
There is no silent local-disk fallback for direct uploads. Local integration tests
mock the provider and authentication; a provider-backed preview test requires a
real seller session. Preview sessions now use host-only cookies, while production
keeps the existing apex/www cookie domain.

Preview currently shares live database/storage configuration. Use only explicitly
approved non-personal test images and do not publish test listings.

## Limits / follow-ups

- Blobs remain public, as before. An unpublished listing is not in the marketplace,
  but anyone with an image's unguessable URL can access that image.
- Removing/replacing photos, abandoning the form, or retrying after a lost upload
  response can leave unreferenced blobs. This change does not delete stored data.
  A future reference-aware retention job should clean these up; never blindly
  delete uploads by age or prefix while listings may still reference them.
- Tokens are file-scoped, not a per-account storage quota. Account-level upload
  rate/budget limits and storage-usage alerting remain separate hardening work.
- Missing historical `/uploads/...` files are not recovered by this change.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
Tests cover an 8 MiB direct upload, tiny metadata-only form payloads, auth/origin
restrictions, token limits, malformed manifests, cross-seller ownership, stored
metadata validation, measurement overrides, retry/order behavior and cancellation.
Browser/provider verification results are recorded in the pull request.
