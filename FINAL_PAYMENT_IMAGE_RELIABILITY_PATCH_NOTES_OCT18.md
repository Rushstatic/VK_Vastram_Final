# VK VASTRAM — Final payment, order-access and image reliability patch

## Code changes in this package

1. **Authenticated order confirmation 401:** `orderService.getOrderById()` now attaches the current Supabase session access token whenever a session exists, even when the caller does not pass a `userId`. The confirmation page previously called the service without a user ID, which meant the session token was omitted and the server correctly rejected access to a registered customer's order.
2. **Stale localhost image URLs:** `normalizeImageUrl()` rejects image URLs whose host is `localhost`, `127.0.0.1`, `0.0.0.0`, or `::1`. Temporary preview URLs such as `http://localhost:37857/2316565.png` are not real public product-image URLs and cannot work for customers or on the deployed site. These URLs are now ignored instead of generating repeated `ERR_CONNECTION_REFUSED` requests.
3. **Coupons and refunds:** The package already includes `supabase/migrations/20261018000002_atomic_coupon_redemption_and_refund_queue.sql`, which applies coupon discounts and records coupon usage inside the order-creation transaction, and adds refund-review status tracking. The migration must be applied to the actual Supabase project for these database-side changes to take effect.
4. **Rate-limit buckets:** Route-specific `bucketName` values are already included, preventing order creation, payment verification, and payment-failure requests from sharing the same rate-limit counter.
5. **Refund alerts / queue:** Captured payments that cannot safely reconcile are marked for refund review and trigger an admin alert. Admin status updates record workflow state; they do not automatically send money to the customer.
6. **Security / text encoding:** The existing code has no hardcoded `vastram2026` shortcut or the mojibake patterns flagged in the review. Browser console messages about blocked accelerometer permissions and unsafe response headers are generally emitted by the preview/browser tooling and are not, by themselves, evidence of a storefront crash.

## Required production data repair

The original image files cannot be reconstructed from the temporary localhost URLs. In Supabase SQL Editor, run this read-only diagnostic:

```sql
SELECT id, product_id, image_url, storage_path
FROM public.product_images
WHERE image_url ILIKE '%localhost:%'
   OR image_url ILIKE '%127.0.0.1:%'
   OR image_url ILIKE '%0.0.0.0:%';
```

If the schema uses different column names, inspect `public.product_images` first and adapt the query. Re-upload each affected original image to Supabase Storage (recommended: a public product-image bucket) from the Admin CMS and save the resulting public URL. Do not replace missing real product photos with another colour variant's photo.

## Apply and verify

1. Back up the Supabase database.
2. Apply pending migrations in chronological order, including `20261018000002_atomic_coupon_redemption_and_refund_queue.sql`, using your normal Supabase migration workflow.
3. Confirm the migration completed successfully; do not blindly rerun a partially failed SQL transaction.
4. Test authenticated order confirmation and guest order confirmation separately. Guest orders must retain and send their `x-guest-token`; do not weaken guest-order authorization to remove a 401.
5. In Razorpay Test Mode, test success, a gateway-declined payment, closing checkout, SDK unavailable, and retrying the same pending order. The external SDK's `ERR_CONNECTION_CLOSED` still requires checking client network/proxy/extensions and Razorpay CDN reachability; code cannot force a blocked CDN to load.
6. Confirm refund-review alerts reach the configured admin email and the dashboard shows the refund status. Manually completing a refund in the dashboard is only a record of completion, not a payment-provider refund operation.
7. Run `npm ci`, `npm run build`, `npm run lint`, and the existing test scripts in the project environment before deployment.

## Verification note

The code edits in this package were applied locally. A fresh build could not be completed in this execution environment because the Vite binary was unavailable and dependency installation timed out; therefore this package is not represented as a fully build-verified production release. Run the commands above locally before deploying.
