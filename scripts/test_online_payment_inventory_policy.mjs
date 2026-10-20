import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const migration = read('supabase/migrations/20261020000001_online_payment_inventory_lifecycle.sql');
const server = read('server.ts');
const checkout = read('src/components/checkout/CheckoutPage.tsx');

function between(source, start, end) {
  const a = source.indexOf(start);
  assert.notEqual(a, -1, `Expected section not found: ${start}`);
  const b = source.indexOf(end, a + start.length);
  assert.notEqual(b, -1, `Expected section terminator not found: ${end}`);
  return source.slice(a, b);
}

const createOrderFn = between(
  migration,
  'CREATE OR REPLACE FUNCTION public.create_order_with_inventory_reservation(',
  'CREATE OR REPLACE FUNCTION public.confirm_inventory_sale_for_order('
);
const confirmSaleFn = between(
  migration,
  'CREATE OR REPLACE FUNCTION public.confirm_inventory_sale_for_order(',
  'CREATE OR REPLACE FUNCTION public.reconcile_captured_payment_for_order('
);
const reconcileFn = between(
  migration,
  'CREATE OR REPLACE FUNCTION public.reconcile_captured_payment_for_order(',
  'REVOKE ALL ON FUNCTION public.confirm_inventory_sale_for_order('
);

// Abandoned online checkouts must not reserve inventory; COD still follows its existing
// transactional reserve -> sale path.
const reserveCall = createOrderFn.indexOf('v_reservation := public.reserve_inventory_for_order');
assert.notEqual(reserveCall, -1, 'COD reservation call must remain present');
const guardStart = createOrderFn.lastIndexOf("IF p_payment_method = 'cod' THEN", reserveCall);
const guardEnd = createOrderFn.indexOf('END IF;', reserveCall);
assert.ok(guardStart >= 0 && guardStart < reserveCall && guardEnd > reserveCall,
  'Inventory reservation must be inside the COD-only branch');
assert.match(createOrderFn, /FOR UPDATE OF pv, p;/, 'Stock validation must serialize the in-transaction availability check');
assert.match(createOrderFn, /stock_quantity, 0\) - COALESCE\(v_variant\.reserved_quantity, 0\) < v_quantity/,
  'Order creation must validate current available stock');
assert.match(createOrderFn, /checkout_payment_method, payment_status, order_status/,
  'Order payment method must be persisted for admin queue filtering');
assert.match(migration, /CREATE TRIGGER orders_sync_admin_queue_visibility[\s\S]*?BEFORE INSERT OR UPDATE OF checkout_payment_method, payment_status/,
  'Admin queue visibility must track payment state changes');
assert.match(migration, /reservation_expires_at = NULL, updated_at = NOW\(\)[\s\S]*?NOT EXISTS \([\s\S]*?movement_type='sale'/,
  'Legacy expiry markers must be cleared without deleting unpaid order audit records');

// Physical stock changes only inside a sale confirmation and is guarded by row locks,
// complete-order validation, and an idempotent sale movement check.
assert.match(confirmSaleFn, /FOR UPDATE;/, 'Sale confirmation must lock inventory variant rows');
assert.match(confirmSaleFn, /stock_quantity = stock_quantity - v_item\.quantity/, 'Verified sale must deduct stock');
assert.match(confirmSaleFn, /movement_type = 'sale'/, 'Sale confirmation must be idempotent by sale movement');
assert.match(confirmSaleFn, /stock_quantity,0\) - COALESCE\(v_item\.reserved_quantity,0\) < v_item\.quantity/,
  'Unreserved online captures must recheck available stock under lock');
assert.match(reconcileFn, /public\.confirm_inventory_sale_for_order\(p_order_id\)/,
  'Verified payment reconciliation must be the path that deducts online stock');
assert.match(reconcileFn, /refund_required/, 'If payment captured but stock cannot be fulfilled, refund review must be flagged');

// Admin's default queue hides pending/failed online order attempts. Explicit payment filters
// remain available, and retry uses the stored internal order ID rather than creating a new order.
assert.match(server, /query = query\.eq\('is_admin_queue_visible', true\)/,
  'Default admin order queue must filter out unpaid online attempts');
assert.match(server, /query = query\.eq\('payment_status', paymentStatus\)/,
  'Explicit payment-status filters must keep failed/pending orders searchable');
assert.match(server, /payment_status: 'failed'/,
  'Failed online payment callback must persist failure state on the existing order');
assert.match(checkout, /PENDING_ONLINE_ORDER_SESSION_KEY/,
  'Checkout must remember an online order being paid');
assert.match(checkout, /launchRazorpayFlow\(storedPendingOrder\.orderId/,
  'Checkout retry must reuse the same internal order ID');
assert.match(checkout, /clearStoredPendingOnlineOrder\(orderId\)/,
  'Successful verified payment must clear the pending retry pointer');

console.log('PASS: online attempts do not reserve stock');
console.log('PASS: COD reserves and confirms inventory transactionally');
console.log('PASS: verified online capture is the only path that deducts stock');
console.log('PASS: default admin queue hides pending/failed online attempts');
console.log('PASS: explicit failed/pending status filters remain available');
console.log('PASS: online retries reuse the saved internal order ID');
