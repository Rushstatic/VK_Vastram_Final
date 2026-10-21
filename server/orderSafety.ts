export interface ValidatedOrderLine {
  product_id: string;
  variant_id: string;
  quantity: number;
  metadata: Record<string, unknown>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class OrderSafetyError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'OrderSafetyError';
  }
}

export function validateOrderLines(items: unknown): ValidatedOrderLine[] {
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
    throw new OrderSafetyError('Cart items are invalid.', 400, 'INVALID_ITEMS');
  }

  const seenVariants = new Set<string>();
  return items.map((rawItem: any) => {
    const productId = rawItem?.product?.id;
    const variantId = rawItem?.variantId;
    const quantity = rawItem?.quantity;

    if (typeof productId !== 'string' || !UUID_PATTERN.test(productId) ||
        typeof variantId !== 'string' || !UUID_PATTERN.test(variantId)) {
      throw new OrderSafetyError('Each cart item must select a valid product and variant.', 400, 'INVALID_VARIANT');
    }
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 2_147_483_647) {
      throw new OrderSafetyError('Item quantities must be positive whole numbers.', 400, 'INVALID_QUANTITY');
    }
    const normalizedVariantId = variantId.toLowerCase();
    if (seenVariants.has(normalizedVariantId)) {
      throw new OrderSafetyError('Duplicate cart lines for the same variant are not allowed.', 400, 'DUPLICATE_VARIANT');
    }
    seenVariants.add(normalizedVariantId);

    // Only identity, quantity, and bounded display metadata cross into the database RPC.
    // Client-provided prices, totals, names, and SKUs are intentionally discarded.
    const metadata: Record<string, unknown> = {};
    if (typeof rawItem.selectedColor === 'string') metadata.color = rawItem.selectedColor.slice(0, 80);
    if (typeof rawItem.selectedSize === 'string') metadata.size = rawItem.selectedSize.slice(0, 80);
    if (typeof rawItem.product?.categoryLabel === 'string') metadata.category = rawItem.product.categoryLabel.slice(0, 120);
    if (typeof rawItem.product?.primaryImage === 'string') metadata.primaryImage = rawItem.product.primaryImage.slice(0, 2048);
    if (rawItem.includeFallPico === true) metadata.includeFallPico = true;

    return { product_id: productId, variant_id: variantId, quantity, metadata };
  });
}

export function requireRpcSuccess(data: any, error: any, operation: string): any {
  if (error) {
    let detail: any = null;
    try { detail = error.details ? JSON.parse(error.details) : null; } catch { /* provider errors are not always JSON */ }
    if (detail?.error) {
      const code = detail.error;
      const statusCode = code === 'ORDER_NOT_FOUND' ? 404 :
        ['ALREADY_SOLD', 'INSUFFICIENT_STOCK', 'VARIANT_NOT_FOUND', 'PRODUCT_UNAVAILABLE', 'INVALID_PRICE', 'COUPON_INVALID', 'COUPON_USAGE_LIMIT', 'COUPON_CUSTOMER_LIMIT', 'COUPON_MINIMUM_NOT_MET'].includes(code) ? 409 : 503;
      throw new OrderSafetyError(detail.message || `${operation} could not be completed.`, statusCode, code);
    }
    if (error.code === '22023') {
      throw new OrderSafetyError('Cart or checkout details are invalid.', 400, error.code);
    }
    console.error(`[${operation}] database error:`, error.code, error.message, error.details || '', error.hint || '');
    throw new OrderSafetyError(`${operation} could not be completed.`, 503, error.code || 'DATABASE_ERROR');
  }
  if (!data || data.success !== true) {
    const code = data?.error || 'RPC_FAILED';
    const statusCode = code === 'ORDER_NOT_FOUND' ? 404 :
      ['INSUFFICIENT_STOCK', 'VARIANT_NOT_FOUND', 'PRODUCT_UNAVAILABLE', 'INVALID_VARIANT', 'INVALID_QUANTITY', 'INVALID_PRICE', 'ALREADY_SOLD', 'CANNOT_CANCEL_AFTER_DISPATCH', 'NOT_A_COD_ORDER', 'INVALID_COD_STATUS', 'INVALID_COD_PAYMENT_TRANSITION', 'COD_COLLECTION_REQUIRES_DELIVERY', 'REFUND_NOT_APPLICABLE', 'INVALID_REFUND_TRANSITION', 'COUPON_INVALID', 'COUPON_USAGE_LIMIT', 'COUPON_CUSTOMER_LIMIT', 'COUPON_MINIMUM_NOT_MET'].includes(code) ? 409 : 503;
    throw new OrderSafetyError(data?.message || `${operation} could not be completed.`, statusCode, code);
  }
  return data;
}

export async function invokeCheckedRpc(
  client: { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: any }> },
  name: string,
  args: Record<string, unknown>,
  operation: string
): Promise<any> {
  const { data, error } = await client.rpc(name, args);
  return requireRpcSuccess(data, error, operation);
}
