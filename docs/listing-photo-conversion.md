# Seller HEIC/HEIF uploads

The shared create/edit listing photo input converts HEIC/HEIF to JPEG before
previewing or submitting the file. JPEG and PNG uploads pass through unchanged.
The decoder (`heic-to` 1.5.2, CSP build) is dynamically imported only when needed,
decodes in a worker, and encodes JPEG at quality 0.9. The primary image is used
for multi-image HEIF files. No conversion service receives the source photo.

## Behavior

- Recognizes `.heic`/`.heif` case-insensitively, including empty browser MIME types.
- Submits `.jpg`, `image/jpeg`, and JPEG bytes together; the ordering manifest
  describes the converted files, not the originals.
- Converts sequentially, with a 25 MB HEIF input limit and 60-second timeout.
- Disables publish/draft/override buttons and guards form submission while busy.
- A failed selection is rejected atomically; previously queued photos remain.
- Reordering and removal work on converted files. Preview URLs are released on
  removal/unmount; raw HEIF is rejected by server storage validation.
- Existing stored media is unchanged. Selecting replacement media on an edit
  continues to replace the listing's media, as before.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
The automated suite covers conversion metadata and bytes, MIME fallback,
invalid/oversized files, timeouts, server rejection, and the Blob upload contract.

Browser verification used the actual seller form against an isolated local
storage endpoint (temporary verification routes are not included in the PR):

- libheif's public `examples/example.heic`, selected as `.heic` and `.HEIF`
  with empty browser MIME types, produced 1280 x 854 JPEG previews.
- Each 718,114-byte source became a 427,729-byte JPEG with `FF D8 FF` signature.
- Reordering was preserved in file input, manifest, received multipart payload,
  and saved media metadata; the production storage function wrote JPEG files.
- Corrupt HEIC showed an actionable error and retained the previous selection.
- A mixed HEIC/HEIF/JPEG selection rendered correctly. During conversion,
  `requestSubmit()` was blocked and Save as Draft was disabled.
- No browser console errors or production data writes occurred.

Sample: https://github.com/strukturag/libheif/blob/master/examples/example.heic
Library notices: `/third-party/heic-to-NOTICE.txt` and
`/third-party/heic-to-LICENSE.txt`.

## Separate existing limitations

This does not recover missing legacy `/uploads/...` files or convert historical
media. The subsequent [direct photo upload change](direct-photo-uploads.md) replaces
the multipart Server Action transport with direct-to-Blob multipart uploads.
No database migration or additional environment variables are required.
