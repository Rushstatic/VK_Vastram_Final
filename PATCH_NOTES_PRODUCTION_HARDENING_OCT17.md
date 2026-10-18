# VK VASTRAM — Production Hardening Patch (2026-10-17)

## Included changes
- Added a server-side `/api/payment/failure` endpoint that verifies order access and payment-attempt association before recording a gateway-reported failure.
- Razorpay checkout failures now attempt to persist `payment_status = failed` and payment-attempt `status = failed` on the existing order. The checkout retains the same internal order ID for payment retry; a stale failure cannot downgrade an already captured payment.
- Added rate limiting for payment-failure reporting.
- Added a CMS/live-catalog-driven New Arrivals homepage section and a NEW tag for the products in that section.
- Removed the local demo product catalog fallback from the storefront. With an empty database, the storefront no longer silently renders fixture products.
- Removed hardcoded category navigation fallbacks; active categories are driven by CMS data.
- Removed the bundled image fallback from the header logo. The configured CMS logo is used when present; otherwise the brand monogram is rendered.
- Tuned desktop navigation typography and spacing for laptop/desktop widths.

## Important deployment notes
1. Deploy the full application (frontend and `server.ts`) together. The new client endpoint depends on the new server route.
2. Confirm the server has `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and a correctly configured Razorpay webhook secret.
3. Verify the `orders` table has `updated_at`, and the `payments` table has `status`, `error_reason`, and `updated_at` columns. These are expected by the current application schema.
4. The code intentionally does not delete production products, orders, coupons, or categories. Clear test data only after taking a database backup and checking foreign-key dependencies; use the Supabase SQL editor/admin CMS rather than a destructive startup script.
5. A failed payment attempt is recorded as failed. The order itself remains available for retry under the same internal order ID; a subsequent attempt creates a new Razorpay gateway order ID associated with that same internal order.

## Validation status
A production build could not be completed in this environment because dependency installation timed out and `vite` was unavailable. Run `npm ci`, then `npm run build` and `npm run lint` in your deployment environment before publishing. Perform a Razorpay test-mode declined-payment test and verify the admin order ledger shows Failed, then retry and confirm the internal order number remains unchanged.
