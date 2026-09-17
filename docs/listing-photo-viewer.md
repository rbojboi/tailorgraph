# Listing photo viewer

Marketplace, seller-profile, saved-item and recommendation cards use the same
`ListingGallery` as listing detail pages. Card arrows or horizontal swipes cycle
through every photo without visiting the listing. Clicking a photo or Expand
opens the selected image in a full-screen modal. Closing preserves the selected
photo and browsing position. Existing View Item, save and purchase actions remain
separate controls.

Images use `object-contain` in cards, detail galleries and the viewer so the whole
garment is visible at the initial zoom. The viewer supports wraparound arrows,
thumbnails, left/right keyboard navigation, horizontal swipes at 100%, pinch and
double-tap/double-click zoom, zoom buttons, reset and bounded dragging at up to
400%. Changing photos resets zoom. Legacy video entries retain native playback
controls. Empty and single-photo galleries work without navigation controls;
failed full-size images show a message while navigation and close remain usable.

The native modal dialog makes the background inert. Opening focuses Close and
locks page scrolling; closing or Escape restores focus and scrolling. Keyboard
photo navigation retains focus in a stable control when zoom controls remount.
Controls have labels and touch targets of at least 44px. Safe-area padding and
dynamic viewport height accommodate phone layouts.

Card images and thumbnails retain responsive Next.js optimization and lazy
loading. Viewer code is dynamically imported and only the active stored master
is loaded for inspection. No database, storage, upload or image migration changes
are needed.

## Verification

- Unit tests cover wraparound/empty navigation, horizontal versus vertical
  gestures, fitted-image pan boundaries and anchored pinch transforms.
- A temporary local fixture exercised the actual buyer card and detail gallery
  at desktop and 390px phone widths. Verified card arrows and dragging without
  navigation, full-garment display, opening the selected photo, mouse double-click
  and button zoom, repeated keyboard navigation, Escape/focus restoration,
  single/empty galleries and navigation after an intentionally missing image.
- Simulated touch PointerEvents exercised the real viewer handlers for pinch
  to 200%, bounded panning, swipe navigation, zoom reset and scroll restoration.
  Physical-device touch behavior was not tested. The temporary route and image
  fixtures are excluded from the change.

Run `npm test`, `npm run lint`, `npm run typecheck` and `npm run build`.
