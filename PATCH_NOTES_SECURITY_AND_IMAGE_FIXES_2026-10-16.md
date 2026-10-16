# VK VASTRAM targeted hardening patch — 2026-10-16

This patch is intentionally targeted. It does not redesign checkout, payment reconciliation, the catalog, or styling outside the product-image loading path.

## Changes included

1. Added `supabase/migrations/20261016000001_security_hardening.sql`:
   - Removes direct client order/order-item insert policies.
   - Revokes direct `INSERT`/`UPDATE`/`DELETE` on orders, order items, and payments from `PUBLIC`, `anon` and `authenticated`; reads remain governed by existing RLS.
   - Restricts client SELECT access on `payments` to the fields the storefront uses, excluding stored payment signatures and internal provider error details.
   - The two client-side order queries were updated to request only the fields covered by those new column-level grants.
   - Restricts guest carts to authenticated owners and admins; guest carts remain in localStorage as in the current frontend.
   - Revokes public/anon/authenticated execution of the six inventory/guest-order `SECURITY DEFINER` RPCs and grants execution to `service_role`.
   - Sets a pinned search path on privileged functions.
2. Product image improvements:
   - The gallery magnifier now accepts `fallbackImageUrl`, retries it if the primary URL fails, and sends `referrerPolicy="no-referrer"` on its `<img>` element.
   - The base image remains visible while magnification is active, so a failed CSS `background-image` cannot hide the only successfully loaded image.
   - Hover magnification activates only on devices that report `(hover: hover) and (pointer: fine)`.
   - The fullscreen viewer retries image fallbacks and uses no-referrer image requests.
   - Supabase storage URL joining removes trailing slashes consistently.
3. Customer order lookup validates UUID/order-number syntax before building its PostgREST filter, and no longer serializes the stored provider signature or internal payment error text. Customer-facing failures return generic messages.
4. Added a React error boundary that provides a recoverable error screen instead of leaving the root blank after a render-time React exception.
5. Removed the local mock admin sign-in from production builds while preserving it for local development. Production UI no longer displays the local test credentials.
6. `npm start` now explicitly sets `NODE_ENV=production` through `scripts/start-production.mjs`, so it serves the built `dist/` output rather than Vite dev middleware. Build the frontend before starting the production server.
7. In production, the server-side privileged Supabase client no longer falls back to the public anon key. If the service-role key is missing, privileged DB operations fail closed rather than quietly running under anon permissions.
8. Removed generated `supabase/.temp/` CLI state from the ZIP; it is already ignored by `supabase/.gitignore` and is not needed by the running website. If using the Supabase CLI locally, relink the project from the Supabase dashboard/project reference.

## Required deployment steps

1. Back up your database and apply `supabase/migrations/20261016000001_security_hardening.sql` to the correct Supabase project. Test the migration against staging first.
2. Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured as server-only secrets. Never expose the service-role key with a `VITE_` prefix or in frontend files.
3. Run `npm ci`, then `npm run build`, then `npm start`. The start command expects `dist/index.html` to exist.
4. Verify guest checkout, signed-in cart CRUD, COD, Razorpay success/failure/retry, guest order lookup, admin order management, cancellation, return/restock, and image browsing on staging before deploying to production.

## Important issues deliberately not redesigned in this patch

- **Razorpay retry reconciliation:** the current payment model appears to store one payment record per order and overwrite `provider_order_id` on retry. This needs a coordinated database/API change to track distinct payment attempts or safely reuse/reconcile an existing Razorpay order. It is not safe to patch by merely relaxing provider-order-ID matching.
- **Rate limiting/security headers and request-size limits:** the current server has no general rate limiter/Helmet integration and permits JSON bodies up to 10 MB. Add a maintained rate-limiting and security-header middleware after selecting limits appropriate to checkout, webhooks, auth, and admin API traffic. Keep webhook raw-body signature verification intact.
- **Spreadsheet parser:** `xlsx@0.18.5` is present and used by the admin import workflow. Replace it with a patched SheetJS distribution or maintained alternative; do not assume bumping the public npm `xlsx` dependency resolves known issues.
- **SVG upload and remaining filter validation:** verify that the server, not only the UI, rejects or sanitizes SVG uploads. Customer order lookup now validates its identifier before constructing the `.or(...)` filter; the admin global-search `.or(...)` expression still needs safe escaping/validation.
- **Coupon application:** server-side order creation should apply an authoritative coupon/discount in the database transaction, instead of recording `discount_amount = 0` when a UI validation response reports a discount.
- **Secrets and live grants:** this ZIP review cannot verify deployed env vars, actual Supabase grants/default privileges, Razorpay dashboard configuration, webhook delivery, CORS/proxy headers, or hosting platform behavior.

## Validation limitation

The supplied ZIP has no `node_modules`, and this patch was not run through `npm ci`, TypeScript, a Vite production build, or live Supabase/Razorpay tests in this environment. Treat it as a targeted code/migration patch that must pass staging validation before production use.
