# VK VASTRAM Operations Release Candidate — 12 Oct 2026

## Changes in this archive
- Fixed admin session restoration to query `profiles.role` directly. `customerService.getProfile()` maps customer fields and drops the role, which made the previous refresh check fail for administrators.
- Wired the existing Saree Types admin page into the admin content router; it previously had navigation but no rendered page.
- Added an admin setting for the free-delivery threshold and checkout progress copy (“Add ₹X more…” / “You have unlocked free delivery”). The threshold is based on subtotal less the currently applied coupon discount.
- Added an admin order invoice print view; browser print allows saving the rendered invoice as PDF. It uses saved order totals and splits the recorded tax amount according to the shipping state.
- Added manually entered courier name, AWB/tracking number, tracking URL and server-side admin endpoint validation.
- Added an additive Supabase migration for courier tracking fields: `supabase/migrations/202610120001_add_manual_courier_tracking.sql`.
- Updated the Vite alias to `import.meta.dirname` to avoid the `__dirname` warning with native config loading.
- Retains the existing Excel exports for orders, products, inventory and coupons/coupon usage.

## Required database step for courier tracking
Apply `supabase/migrations/202610120001_add_manual_courier_tracking.sql` to the same Supabase project before using Save Tracking. The courier fields are manual; no external courier API has been connected.

## Important limitations — not a full production sign-off
- The GST print view splits the already-recorded order tax total based on the delivery state. Seller GSTIN, HSN/SAC, per-line tax rates and statutory invoice compliance have not been configured or verified. Do not treat this as a compliant tax invoice until your accountant confirms those details.
- Paid Fall & Pico is **not implemented end-to-end** in this release. It needs a server-authoritative fee in checkout/RPC and an immutable saved order field; displaying a frontend-only fee would be unsafe.
- Free-delivery messaging is implemented, but the server-side shipping charge calculation must be confirmed against your production checkout/database function before launch.
- Order cancellation controls and lifecycle logic are retained from the existing code; real refund and inventory-release behavior still requires a staging test against your deployed Supabase schema and payment setup.
- Product image fullscreen viewing was already present through the gallery's magnifier/viewer flow; this archive does not replace the existing image pipeline.
- Dependency installation timed out in the build environment, so a fresh lint/build could not be run here. Run `npm ci`, `npm run lint`, and `npm run build` locally before deploying.
