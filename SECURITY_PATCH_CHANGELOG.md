# VK VASTRAM Security Patch — 2026-10-16

## Included in this ZIP

- Persist every Razorpay order as a separate `payments` row rather than overwriting the previous attempt.
- Verify customer payment callbacks against the persisted `provider_order_id`, Razorpay signature, and Razorpay's payment API; webhook captures are also checked against the provider API and persisted amount/currency.
- Handle `order.paid` webhooks by resolving the captured payment through Razorpay before reconciliation.
- Add a unique partial index for non-null Razorpay order IDs and update payment reconciliation so a second captured attempt is flagged for refund/manual review rather than re-confirming inventory.
- Add API request throttles for order, payment, coupon, and admin routes; COD adds phone/email/IP throttles and a conservative pre-tax subtotal ceiling. OTP is **not** enabled.
- Preserve raw webhook bytes for HMAC verification; use a small global JSON body limit and separate bounded parsers for webhook and image upload routes.
- Add baseline security response headers and a configurable trusted-proxy hop count for Render.
- Reject SVG in admin media uploads, enforce an 8 MB limit, and validate JPEG/PNG/WebP file signatures on admin and review-photo uploads.
- Validate order lookup identifiers before PostgREST `.or(...)` use; sanitize admin order search terms.
- Customer order lookup selects a restricted payment column set, excludes provider signatures/error details, and chooses a persisted provider attempt for its summary.
- Stop accepting guest access tokens in query strings. Legacy request-body token support remains temporarily for compatibility; use `X-Guest-Token` for future token-bearing requests.
- Restrict direct public coupon enumeration and restrict public `site_settings` rows to `general`, `policies`, and `saree_types`.
- Add `.gitignore` entries for environment files, build output, dependency folders, and Supabase CLI temp metadata; remove the local one-off patch script from the distributable ZIP.

## Important limitations — staging review required

This is **not a certification of production safety**. Dependency installation timed out in the patch environment, so `npm ci`, `npm run lint`, `npm run build`, and runtime/integration tests could not be completed. A global TypeScript invocation was attempted but could not resolve project dependencies/types.

The rate limiter is an in-process fallback because package installation could not complete. It is not shared across multiple Render instances and resets on process restart. Before running multiple instances or relying on distributed abuse protection, replace it with `express-rate-limit` backed by a shared store (or an equivalent maintained distributed limiter) and update both `package.json` and `package-lock.json`.

The current authoritative order-creation RPC does not yet apply coupon discounts and enforce coupon usage limits atomically with order creation. The public coupon validation endpoint is only a preview; **do not treat coupon eligibility/discount integrity as fully hardened by this patch**. Before launch, update and test the SQL order RPC to lock/revalidate coupon status, date window, minimum order, global/per-customer limits, discount cap and rounding in the same transaction as authoritative totals. Ensure order totals and Razorpay amount match that transaction result.

COD's server-side ceiling is a conservative item-subtotal limit, not a full post-tax/shipping final-total limit. No SMS OTP integration was added. Search settings visibility in staging because the public settings allowlist intentionally exposes only the storefront keys currently identified in source.

The payment-attempt migration assumes existing non-null `payments.provider_order_id` values are unique. Check for duplicate values before applying; resolve duplicates manually rather than deleting payment history.

## Apply safely

1. Create a Supabase staging project/branch and a database backup.
2. Inspect `supabase/migrations/20261016000002_payment_attempts_and_public_data.sql`, especially the unique index and RLS changes. Check duplicate provider order IDs first:
   ```sql
   SELECT provider_order_id, COUNT(*)
   FROM public.payments
   WHERE provider_order_id IS NOT NULL
   GROUP BY provider_order_id
   HAVING COUNT(*) > 1;
   ```
3. Apply migrations to staging first with `npx supabase db push` after confirming the CLI is linked to the intended staging project. Do not apply to production by accident.
4. Run `npm ci`, `npm run lint`, and `npm run build` in a normal local environment.
5. In Razorpay test mode, test: a successful payment, a failed payment followed by retry, an older attempt captured after a retry begins, duplicate webhooks, two captured attempts for one order, a captured payment after cancellation, wrong amount/currency, and invalid webhook signatures.
6. Test guest order lookup with `X-Guest-Token`, ensure query-string tokens are rejected, and verify customer responses contain no `provider_signature` or raw provider error.
7. Test admin uploads for valid JPEG/PNG/WebP, mismatched MIME/signature, oversized images, SVG, and non-admin callers.
8. Verify public storefront settings still load and internal settings/coupon rows are not exposed via the anon key.
9. Only after staging passes should the migration and server patch be deployed to production. Keep rollback/restore steps ready.
