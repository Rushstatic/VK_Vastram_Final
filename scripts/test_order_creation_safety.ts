import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { invokeCheckedRpc, OrderSafetyError, validateOrderLines } from '../server/orderSafety.ts';

const productId = '61f35d80-2202-4e0d-8f80-5c9a31c651a3';
const variantId = 'd9b0b849-5089-4a30-908b-7ed2a2d9e22b';
const validLine = (overrides: Record<string, unknown> = {}) => ({
  product: { id: productId, price: 1, name: 'Forged name', sku: 'Forged SKU' },
  variantId,
  quantity: 2,
  price: 1,
  total: 2,
  ...overrides,
});

const safeLine = validateOrderLines([validLine()])[0];
assert.deepEqual(safeLine, {
  product_id: productId,
  variant_id: variantId,
  quantity: 2,
  metadata: {},
});
assert.equal('price' in safeLine, false, 'forged client prices must not reach the transactional RPC');
console.log('[PASS] Forged client price/name/SKU fields are discarded.');

assert.throws(() => validateOrderLines([validLine({ variantId: undefined })]), (e: any) => e.code === 'INVALID_VARIANT');
assert.throws(() => validateOrderLines([validLine({ product: { id: 'not-a-uuid' } })]), (e: any) => e.code === 'INVALID_VARIANT');
console.log('[PASS] Missing or malformed product/variant IDs are rejected.');

for (const quantity of [0, -1, 1.5, '2', Number.NaN, Number.MAX_SAFE_INTEGER + 1, 2_147_483_648]) {
  assert.throws(() => validateOrderLines([validLine({ quantity })]), (e: any) => e.code === 'INVALID_QUANTITY');
}
console.log('[PASS] Zero, negative, fractional, string, and unsafe quantities are rejected.');

assert.throws(() => validateOrderLines([validLine(), validLine()]), (e: any) => e.code === 'DUPLICATE_VARIANT');
console.log('[PASS] Duplicate variant lines are rejected before reservation.');

const fakeRpc = (response: { data?: any; error?: any }) => ({
  rpc: async () => ({ data: response.data ?? null, error: response.error ?? null }),
});
assert.deepEqual(await invokeCheckedRpc(fakeRpc({ data: { success: true, order_id: 'order-1', order_number: 'VKV-202610-AABBCCDD' } }), 'create_order_with_inventory_reservation', {}, 'Order creation'), { success: true, order_id: 'order-1', order_number: 'VKV-202610-AABBCCDD' });

for (const [errorCode, status] of [['INSUFFICIENT_STOCK', 409], ['VARIANT_NOT_FOUND', 409], ['PRODUCT_UNAVAILABLE', 409], ['INVALID_PRICE', 409]] as const) {
  await assert.rejects(
    invokeCheckedRpc(fakeRpc({ error: { code: 'P0001', details: JSON.stringify({ error: errorCode }) } }), 'create_order_with_inventory_reservation', {}, 'Order creation'),
    (e: any) => e instanceof OrderSafetyError && e.statusCode === status
  );
}
console.log('[PASS] Insufficient stock and missing/inactive database variants fail closed.');

for (const operation of ['order_items insert', 'COD payment insert']) {
  await assert.rejects(
    invokeCheckedRpc(fakeRpc({ error: { code: '23502', message: `${operation} failed` } }), 'create_order_with_inventory_reservation', {}, 'Order creation'),
    (e: any) => e instanceof OrderSafetyError && e.statusCode === 503
  );
}
await assert.rejects(
  invokeCheckedRpc(fakeRpc({ error: { code: '08006', message: 'database unavailable' } }), 'create_order_with_inventory_reservation', {}, 'Order creation'),
  (e: any) => e instanceof OrderSafetyError && e.statusCode === 503
);
await assert.rejects(
  invokeCheckedRpc(fakeRpc({ error: { code: 'P0001', details: JSON.stringify({ error: 'ALREADY_SOLD' }) } }), 'cancel_order_and_release_inventory', {}, 'Order cancellation'),
  (e: any) => e instanceof OrderSafetyError && e.code === 'ALREADY_SOLD' && e.statusCode === 409
);
console.log('[PASS] RPC/database, item/payment insert, inventory, and cancellation release failures cannot report success.');

const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261006000001_transactional_checkout_safety.sql');
const migration = fs.readFileSync(migrationPath, 'utf8');
const serverSource = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');
const createRoute = serverSource.slice(serverSource.indexOf("'/api/orders/create'"), serverSource.indexOf("'/api/orders/" , serverSource.indexOf("'/api/orders/create'") + 1));
assert.match(createRoute, /create_order_with_inventory_reservation/);
assert.doesNotMatch(createRoute, /product_variants['"`]?\)\.upsert|stock_quantity:\s*100|var-default|item\.price|item\.product\?\.price|reserveInMemoryStock/);
const cancellationRoutes = serverSource.slice(serverSource.indexOf("'/api/orders/:id/cancel'"), serverSource.indexOf("'/api/admin/orders/:id/return'"));
assert.match(cancellationRoutes, /cancel_order_and_release_inventory/);
assert.doesNotMatch(cancellationRoutes, /releaseInMemoryReservation/);
console.log('[PASS] Checkout and all cancellation routes have no fake/in-memory inventory fallback.');

const orderItemsInsert = migration.indexOf('INSERT INTO public.order_items');
const reservation = migration.indexOf('public.reserve_inventory_for_order');
const paymentInsert = migration.indexOf('INSERT INTO public.payments');
const codConfirmation = migration.indexOf('public.confirm_inventory_sale_for_order');
assert.ok(orderItemsInsert >= 0 && reservation > orderItemsInsert && paymentInsert > reservation && codConfirmation > paymentInsert);
assert.match(migration, /RAISE EXCEPTION 'Inventory reservation failed'/);
assert.match(migration, /RAISE EXCEPTION 'COD inventory confirmation failed'/);
const cancelFunction = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.cancel_order_and_release_inventory'));
assert.ok(cancelFunction.indexOf('public.release_inventory_for_order') < cancelFunction.indexOf('UPDATE public.orders'));
assert.match(cancelFunction, /RAISE EXCEPTION 'Inventory release failed'/);
console.log('[PASS] Migration contract keeps order items, reservation, COD payment/confirmation, and cancellation atomic.');

console.log('Order creation safety checks passed. SQL failure cases are contract/fault-injection checks; live PostgreSQL execution was not available.');
