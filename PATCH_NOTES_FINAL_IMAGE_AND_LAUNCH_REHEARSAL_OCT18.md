# VK VASTRAM — Final image reliability and launch rehearsal patch

## Product image blank-screen safeguards

- The root application is wrapped in `AppErrorBoundary`, so an uncaught React render exception displays a recovery screen rather than an empty page.
- `ProductImageMagnifier` keeps the original `<img>` visible when the zoom layer is enabled, checks `(hover: hover) and (pointer: fine)` before activating magnification, and applies `referrerPolicy="no-referrer"` to its image.
- `MobileImageViewer` applies `referrerPolicy="no-referrer"`, resets image loading state with `useLayoutEffect`, and provides an explicit failed-image state instead of leaving a blank stage.
- `ImageContainer` now resets active URL and loaded state in `useLayoutEffect`, reducing the cached-image load/reset race.
- Product-card image clicks open the product detail page on the first click/tap; Quick View remains a separate button action.

Important: these changes address interaction/state bugs. They cannot make a private or hotlink-blocked Google Drive file publicly readable. For launch-critical product images, upload the originals through the admin media uploader to the configured public Supabase Storage product-assets location, confirm the resulting public URLs, and verify they load in an incognito browser. Do not delete source files from Drive until verified replacements are live.

## Launch celebration rehearsal controls

- Admin dashboard Preview celebration uses a server-side atomic RPC counter stored in `site_settings`.
- Five total activations maximum across authenticated admin sessions/devices. Up to four rehearsal previews are allowed, and the fifth potential use is reserved for the one-time official launch. Once the official launch fires, all further activations are blocked.
- The overlay automatically closes after approximately 16 seconds. The celebration source remains in the deployed code; the usage marker stops further activations after the official launch (and the five-use gate prevents a fifth rehearsal from consuming the launch slot). There is no need to manually remove code for the limit to work.

## Required Supabase step

Apply `supabase/migrations/20261018000001_launch_celebration_preview_limit.sql` to the same Supabase project before using the preview button. Safest for this final one-off patch: paste this migration file into SQL Editor for the correct Supabase project and run it. Use `supabase db push` only if you have confirmed the remote migration history is in sync and only the intended migration is pending, because that command may apply other pending migrations too.

The migration creates `public.consume_launch_celebration_use(p_mode)`, which requires an authenticated admin role and atomically caps all celebration activations at five. It reserves one use for the official launch and records the official marker in the same transaction.

## Verify before deployment

```powershell
npm ci
npm run build
npm run lint
npx tsx scripts/test_cart_variant_image_resolution.ts
```

Then verify in a browser: click product-card image once, open the detail gallery, open fullscreen on mobile and desktop, test a valid image URL and a deliberately unavailable URL, preview launch twice (in two separate admin sessions), and confirm the UI shows the same persisted remaining count. After four previews, the preview control should be disabled while Start Official Launch remains available as the reserved fifth possible use. When the official launch runs, no further activation is allowed.
