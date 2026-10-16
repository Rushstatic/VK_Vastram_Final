You are editing the attached VK VASTRAM React/Vite + Express + Supabase + Razorpay project. Preserve the existing design and all working features. Make a minimal, testable patch and return a complete updated ZIP, not only advice. Do not fabricate a successful build or test result.

CONTEXT / ISSUES TO FIX NEXT

1. Razorpay retry can orphan a captured payment. In `server.ts`, `/api/payment/create-order` creates a new Razorpay order and then overwrites the existing `payments.provider_order_id` for an order. If payment attempt A is captured but unverified, and attempt B overwrites the record before A's verification/webhook is handled, existing order-ID matching may reject A even though the customer paid. Redesign with a database migration for multiple payment attempts (preferred) or safely reuse/reconcile an existing Razorpay order. Webhook and verification must match by provider order ID to a persisted attempt, validate payment ID/amount/currency/status via Razorpay, be idempotent, and never accept a frontend success claim. Handle concurrent retries and captured/failed/refunded attempts transactionally.

2. Rate limit API abuse while keeping Razorpay webhooks functional. Add maintained rate limiting (prefer a dependency supported by the package manager) for login/auth, order creation, coupon validation, payment initialization/verification, guest order lookup, and admin routes. Use stricter limits for expensive or abuse-prone endpoints and appropriate proxy/IP handling. Do not rate-limit webhook retries in a way that prevents provider delivery; preserve exact raw-body HMAC verification. Replace the 10 MB global JSON body limit with sensible per-route limits, while preserving raw webhook body capture. Add security headers (Helmet or equivalent), and define a deliberate CORS policy if browser origins require it. Ensure the resulting dependencies and lockfile are updated consistently.

3. COD abuse controls: add server-side order value limits, per-phone/email/IP throttles, validation, and optionally OTP verification if a legitimate SMS provider is configured. Do not claim OTP is enabled unless integrated end-to-end. Do not block normal returning customers unfairly.

4. SVG upload: the backend must reject SVG uploads or sanitize them with a proven server-side sanitizer. Frontend-only validation is insufficient. Preserve existing image uploads for JPEG/PNG/WebP, enforce content type and size limits, and verify upload authorization on server/storage.

5. Filter injection/input validation: find PostgREST `.or(...)` calls that interpolate raw URL/search text, particularly order lookup and admin global search. Validate UUIDs/order-number syntax for identifiers; for search terms safely escape PostgREST filter grammar or replace with dedicated RPC/search logic. Do not break legitimate order number formats or admin search.

6. Order response data minimization: remove provider signatures and raw internal database/provider error text from customer API responses. Keep details in server logs with request IDs, without logging secrets, guest tokens, or full payment credentials. Do not change admin diagnostics without a reason.

7. Guest order tokens: prefer the `X-Guest-Token` header for token-bearing requests. Avoid query-string tokens, which can be logged or leaked through referrers. Maintain a temporary compatibility window only if needed, document it, and avoid logging token-bearing URLs.

8. Validate checkout inputs on the server: constrain name/address/city/state/pincode/phone/email/notes length and format; bound item count and quantities; treat product image/description and pricing snapshots as server-derived values rather than trusting client-supplied `primaryImage`/metadata. Preserve legitimate Indian address formats and current tax/shipping behavior.

9. Coupons: align validation and order creation. The authoritative order RPC must revalidate active/expiry/minimum/order-user usage limits and calculate the discount in the same transaction as the price and order snapshots. Do not trust the client-sent discount. Include fixed-amount and percentage coupons, rounding rules and maximum discount behavior, and test that the paid Razorpay amount equals the authoritative payable total.

10. Public data review: check whether public visibility of all active coupon codes and all site settings is intentional. Restrict internal settings and sensitive promotion data while keeping storefront-required settings readable. Do not break public catalog or checkout settings.

11. Housekeeping: ensure deployment artifacts don't contain `.supabase`/`.temp` internal connection metadata, local patch scripts, unused migration notes, or credentials. Do not delete useful source migrations or documentation blindly. Add an appropriate `.gitignore`/deployment exclusion rather than destructive cleanup if uncertain. Inspect source and built bundles for keys, secrets, local admin credentials, and service-role values. Public Supabase anon keys are not secrets but must be constrained by RLS.

CURRENT PATCH ALREADY APPLIED IN ATTACHED ZIP

- `supabase/migrations/20261016000001_security_hardening.sql` removes client order/item insert policies, revokes direct transactional writes for anon/authenticated users, restricts database guest carts to owners, restricts key inventory/guest-link SECURITY DEFINER RPCs to service_role, and pins search_path on privileged functions.
- Product gallery/fullscreen image fallback and no-referrer behavior were improved; touch devices no longer hide the base image merely by synthesizing hover. Supabase storage URL trailing slash handling is normalized.
- Customer payment reads use a restricted column list that excludes stored provider signatures and provider error details; the SQL migration provides matching column-level grants. The customer order lookup validates UUID/order-number syntax before creating its `.or(...)` filter and avoids returning internal payment/error details.
- A React error boundary prevents render exceptions from simply blanking the whole app.
- Generated `supabase/.temp/` CLI metadata was removed from the project ZIP; the directory is already ignored and is not needed by the running site.
- Mock local admin sign-in is development-only; production startup explicitly selects production mode and refuses to use an anon key as the privileged server-side Supabase client.

NON-NEGOTIABLE REQUIREMENTS

- Make small, reviewable changes. Preserve current storefront UI, cart behavior, variant selection, GST/shipping/coupon intent, Razorpay verification and webhook signature checks, and admin workflows unless a specific security issue requires a change.
- Do not remove checks to make tests pass. Add/extend tests for any changed logic.
- Use proper transactional migrations and idempotency for payments/inventory. Never claim a payment is successful from the browser alone.
- Use production-safe errors and least-privilege permissions. Harden SECURITY DEFINER functions with explicit `search_path` and grants.
- Update package.json and package-lock consistently if adding dependencies.
- Inspect the full changed files and show a summary of files changed. Run `npm ci`, TypeScript/lint (`npm run lint`), production build (`npm run build`) and relevant tests if dependencies/network permit. If unable to run them, report exactly what was not run and why.
- Return the full updated ZIP plus a changelog and deployment/migration steps. Flag any migration that needs manual review. Never assert production safety without a staging validation plan.
