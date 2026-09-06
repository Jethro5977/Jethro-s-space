# Pack reveal enhancement — 2026-09-06

## Production implementation

- `src/pack-celebration.js` integrates the unmodified ESM build of [catdad/canvas-confetti 1.9.4](https://github.com/catdad/canvas-confetti/releases/tag/1.9.4).
- The module and ISC license are vendored under `assets/vendor/canvas-confetti/`; the adjacent README records download provenance and SHA-256 hashes. Runtime requests stay on the application origin.
- Silver paper fragments accompany tearing. Neon uses mint/cyan/violet stars, gold uses two champagne fans, and black-label cards use a slower radial star burst. Mobile particle counts are reduced to 65%.
- Rare hits fire 320 ms into the flip, when the portrait begins to appear. A short CSS foil glint, rarity/name captions and live reveal count complete the presentation.
- Rare-hit animations no longer apply brightness filters to the preserve-3d inner; this fixes a mirrored card back appearing during the flip. Bursts also have a 2.8-second wall-clock limit on slower devices.
- All pack sessions use an AbortSignal to clean up particles, dust, temporary overlays, intervals and scheduled callbacks. A visible close button is available throughout, alongside Escape and DONE.
- Reduced-motion preferences are checked at launch and observed live. Mobile cards support horizontal scroll snapping within the pack, without overflowing the viewport.

## Verification

Run `npm run test:pack` for actual confetti canvas pixels, all three rare-hit themes, reveal progress, early close/reopen cancellation, mobile completion and live reduced-motion cancellation. Screenshots are written to Playwright's ignored test output directory.

Verified locally: pack regression 5/5, existing app E2E 8/8, renderer build/unit tests 46/46, unchanged export-effect pixel baselines 8/8, and syntax/media/CSS checks. Desktop rare-hit and 390px mobile screenshots were inspected. The drag test covers pointer cancellation followed by a successful full tear.

`npm run test:e2e` covers the existing application and PNG export. `npm run test:renderer` builds and checks the published ESM/UMD API; the live application continues to load the source entry through its import map.

The renderer source and package API are unchanged by this enhancement. No npm package was published. Deployment targets the existing Vercel `cardsbuilder` project.
