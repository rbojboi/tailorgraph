# Listing photo optimization

## Uploads

The shared create/edit photo picker calls `prepareListingPhoto` before queuing
each direct Blob upload. HEIC/HEIF conversion still runs first. Browser canvas
processing then caps the longest edge at 2,400 pixels without upscaling or
cropping. JPEGs use quality 0.88; PNGs retain transparency and lossless encoding.
An already-bounded photo stays byte-for-byte unchanged if re-encoding would make
it larger. The stored file's extension, MIME type and timestamp stay consistent.
The browser applies EXIF orientation before drawing and does not carry the old
orientation tag into the encoded image.

Decoding and encoding each have a 30-second timeout. Processing remains
sequential, with canvas memory and object URLs released after each photo. A
corrupt/unsupported image fails the selection with a useful error, preserving
earlier queued photos. Saving stays blocked during preparation and unfinished
uploads. Retry uploads the already-prepared file rather than encoding again.

This is a client-side optimization, not a new server security limit. Existing
authenticated upload tokens, 25 MiB input/output limit, seller ownership checks,
ordered manifests, pause/retry behavior and direct multipart uploads remain.
No second archival copy of a new oversized original is uploaded. Existing stored
images are not rewritten or deleted; there is no data migration.

## Display

`ListingImage` uses Next.js image optimization with responsive `sizes`, lazy
loading by default and WebP negotiation. Marketplace/account cards, cart and
checkout photos, seller views, gallery thumbnails and existing upload previews
request variants suited to their displayed size. The active gallery image loads
eagerly. The [photo viewer](listing-photo-viewer.md) opens the stored master in
an in-page gallery when the buyer needs detail.
Local browser object-URL previews continue using a native image element.

Only HTTPS public Vercel Blob `/listings/**` URLs with no query string or custom
port are enabled as remote optimizer sources. Legacy external sources keep
working without optimization. Local images also use Next's optimizer. Old Blob
photos benefit from smaller display variants without changing their records.
Next/Vercel caches variants on demand; image transformation usage is subject to
the hosting plan. Missing historical local files remain missing.

## Verification (2026-09-16)

- 110 automated tests pass, including dimensions, no upscaling, format handling,
  resize errors/timeouts/resource release and the existing direct-upload suite.
- Local browser ran the actual photo preparation code with JPEG, PNG and HEIC.
  A 6,072,062-byte 3,200 x 2,400 synthetic JPEG became 2,507,851 bytes at
  2,400 x 1,800. A rotated JPEG became 1,800 x 2,400 with expected corner colors.
  PNG alpha remained 128/255. A small 320 x 240 JPEG stayed at 955 bytes.
  HEIC decoded to a valid 1,280 x 854 JPEG. Corrupt JPEG returned the expected error.
- Actual optimized endpoint returned WebP: 89,426 bytes at requested width 640
  for the 6.07 MB sample; gallery thumbnail requested width 96.
- Gallery switching updated the full-size link; images rendered with no console
  warnings/errors before the intentional unauthenticated upload check.
- Shared seller picker queued the prepared 2.4 MiB JPEG and oriented portrait,
  disabled saving during preparation, and kept saving disabled after the local
  authenticated endpoint rejected uploads. No live Blob upload or listing write
  was performed. Storage success/retry/order paths are covered by mocked tests.
- Temporary local verification route and fixtures are removed before committing.

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
