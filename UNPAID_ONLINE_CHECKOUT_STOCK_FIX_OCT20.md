# VK VASTRAM — Unpaid Online Checkout / Inventory Lifecycle Fix

## Behaviour after the migration

- Creating an online checkout keeps a provisional order and initial payment row so a checkout retry can use the same internal order ID. This is an audit/retry record, not a fulfilment order.
- Online checkout does **not** create an inventory reservation and does not increment `reserved_quantity`.
- Available stock is checked under a database row lock at order creation to provide immediate feedback, then checked again under exclusive variant locks when a server-verified Razorpay capture is reconciled.
- Only the verified captured-payment reconciliation can deduct online stock. The existing idempotent sale movement ensures duplicate verification/webhook events do not double-deduct.
- If Razorpay captures funds but inventory is no longer available when reconciliation obtains the lock, payment remains recorded as captured and the order is cancelled/flagged for refund review; the system does not silently pretend payment failed or deduct negative stock.
- COD remains an accepted order: it reserves and confirms stock in the existing transaction and remains visible to Admin.
- The default Admin Orders queue shows COD orders and paid/captured orders. Unpaid online checkouts are retained in the database for audit and retry, but hidden from the default operational queue. Admin can select Pending or Failed in Payment Status to inspect them.
- Same-tab retries reuse the saved checkout's internal order ID when the checkout fingerprint matches. Each actual Razorpay order remains a separately persisted payment attempt; old attempts are not overwritten.
- The migration releases existing legacy online reservations associated with pending/failed unpaid attempts where a reservation is recorded and no sale exists. It does not delete orders/payment records.

## Files changed

- `supabase/migrations/20261020000001_online_payment_inventory_lifecycle.sql`
  - Adds persisted payment method and admin-queue visibility, clears legacy holds, updates transactional order creation and inventory confirmation/reconciliation functions, and creates idempotency records for order-placement email notifications.
- `server.ts`
  - Restricts the default Admin Orders query to the operational queue, retains explicit Payment Status filters, sends online order-placement notifications only after verified capture, keeps COD notifications at accepted order creation, and guards notifications against duplicate verification/webhook delivery.
- `src/components/checkout/CheckoutPage.tsx`
  - Stores an in-session online order pointer/fingerprint and retries using the same internal order ID when the checkout details match.
- `scripts/test_online_payment_inventory_policy.mjs`
  - Adds a dependency-free static regression test for the key policy invariants.
- `package.json`
  - Adds `npm run test:online-payment-stock-policy`.

## Deploy carefully

1. Back up the current project and database before deploying.
2. Check `npx supabase migration list` and `npx supabase db push --dry-run`. Make sure prerequisite migrations already present in the project are reconciled with remote migration history. Do not blindly push if local and remote histories diverge.
3. Apply `20261020000001_online_payment_inventory_lifecycle.sql` in staging first. It contains transactional DDL and function replacements, plus cleanup of recorded legacy unpaid-online holds; review before production.
4. Deploy the matching source code. Migration and server source must be deployed together, because the admin default queue references `orders.is_admin_queue_visible`.
5. Run `npm run test:online-payment-stock-policy`, `npm ci`, `npm run lint`, and `npm run build`.
6. In Razorpay test mode, verify: (a) close checkout without paying — stock and `reserved_quantity` unchanged; unpaid online order absent from default Admin queue; (b) explicit Pending/Failed filter can find it; (c) fail then retry — same order number/internal order ID; (d) successful capture — exactly one stock sale movement and one stock deduction; (e) duplicate webhook — no second deduction; (f) COD order — visible and stock deducted exactly once; (g) capture after another customer buys the last item — order gets refund review and inventory never becomes negative.

## Verification status

The source files pass a TypeScript transpile/syntax check in this environment. A complete `npm ci` timed out here, so full `npm run lint` and `npm run build` were **not verified** in this environment. The regression test is a static source-policy check, not a substitute for staging integration tests against PostgreSQL, Supabase, or Razorpay.

## Follow-up repair included in this archive

- Added `20261020170000_repair_stale_reserved_stock_and_unpaid_email.sql` to reconcile drifted `reserved_quantity` values against the active reservation ledger. This specifically addresses variants that remain out of stock even after the original checkout reservation should have expired.
- Added a server-side one-minute sweep: online checkouts still pending after five minutes become failed/cancelled (not fulfilment orders), their reservation expiry is cleared, and the admin is alerted through the existing Resend notification path. Razorpay `payment.failed` events also trigger an admin alert.
- Configure `ADMIN_NOTIFICATION_EMAIL`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` in the production server environment. The sweep runs in the Node server process; it does not run if the production server is stopped. Apply the SQL migration and deploy the matching server code together.
- COD orders continue to be accepted and stock is deducted once. Online stock is deducted only after verified capture. A late capture for an expired/cancelled order must still be reconciled through the existing refund-review safeguards.
