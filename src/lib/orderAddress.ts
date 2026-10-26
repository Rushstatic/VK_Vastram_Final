/**
 * Helpers for orders where the customer chose "Buy from shop" (store pickup).
 * Those orders carry fulfillmentMethod = 'store_pickup' in the address snapshot, have no courier
 * address, and no delivery charge.
 */
export const isStorePickup = (snapshot: any): boolean => snapshot?.fulfillmentMethod === 'store_pickup';

/** "city, state — pincode" for delivered orders, "Store pickup" for orders collected from the shop. */
export const formatCityLine = (snapshot: any, separator = ' — '): string =>
  isStorePickup(snapshot)
    ? 'Store pickup (collect from shop)'
    : `${snapshot?.city || ''}, ${snapshot?.state || ''}${separator}${snapshot?.pincode || ''}`;
