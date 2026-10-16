import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CartItem, CustomerAddress, OrderData, OrderItemData } from '../types';
import { cartService } from './cartService';
import { normalizeImageUrl } from '../lib/imageHelper';

// In-flight request lock to prevent accidental duplicate orders
const activeSubmissionLocks = new Set<string>();

export interface CheckoutValidationResult {
  isValid: boolean;
  hasPriceChanges: boolean;
  hasStockError: boolean;
  priceChangeMessages?: string[];
  stockErrorMessage?: string;
  authoritativeSubtotal: number;
  validatedItems: CartItem[];
}

export const orderService = {
  /**
   * Re-validate cart items against real database prices and stock availability
   */
  async validateCheckoutCart(items: CartItem[]): Promise<CheckoutValidationResult> {
    if (items.length === 0) {
      return {
        isValid: false,
        hasPriceChanges: false,
        hasStockError: true,
        stockErrorMessage: 'Your shopping bag is empty.',
        authoritativeSubtotal: 0,
        validatedItems: [],
      };
    }

    if (!isSupabaseConfigured()) {
      return {
        isValid: false,
        hasPriceChanges: false,
        hasStockError: true,
        stockErrorMessage: 'Checkout is temporarily unavailable. Please try again shortly.',
        authoritativeSubtotal: 0,
        validatedItems: [],
      };
    }

    if (items.some((item) => !Number.isSafeInteger(item.quantity) || item.quantity <= 0 || item.quantity > 2_147_483_647 || !item.product?.id)) {
      return {
        isValid: false,
        hasPriceChanges: false,
        hasStockError: true,
        stockErrorMessage: 'Your bag contains an invalid item quantity or product. Please refresh your bag.',
        authoritativeSubtotal: 0,
        validatedItems: [],
      };
    }

    try {
      const productIds = Array.from(new Set(items.map((i) => i.product.id)));
      const { data: dbProducts, error: productQueryError } = await (supabase as any)
        .from('products')
        .select(`
          id,
          name,
          price,
          status,
          variants:product_variants(id, sku, price_override, stock_quantity, reserved_quantity, is_active)
        `)
        .in('id', productIds);

      if (productQueryError) throw productQueryError;
      if (!Array.isArray(dbProducts)) throw new Error('Product validation returned no usable data.');

      const priceChangeMessages: string[] = [];
      let hasStockError = false;
      let stockErrorMessage = '';
      let authoritativeSubtotal = 0;
      const seenVariants = new Set<string>();

      const validatedItems: CartItem[] = items.map((item) => {
        const dbProd = dbProducts?.find((p: any) => p.id === item.product.id);
        if (!dbProd || dbProd.status !== 'active') {
          hasStockError = true;
          stockErrorMessage = `"${item.product.name}" is no longer available in catalog.`;
          return item;
        }

        // Find relevant variant
        const availableVariants = (dbProd.variants || []).filter((v: any) => v.is_active !== false);
        const dbVariant = item.variantId
          ? availableVariants.find((v: any) => v.id === item.variantId)
          : availableVariants.length === 1 ? availableVariants[0] : undefined;

        if (!dbVariant) {
          hasStockError = true;
          stockErrorMessage = `"${item.product.name}" has no valid selected variant. Please refresh your bag and try again.`;
          return item;
        }
        if (seenVariants.has(dbVariant.id)) {
          hasStockError = true;
          stockErrorMessage = 'Your bag contains the same product variant more than once. Please refresh your bag.';
          return item;
        }
        seenVariants.add(dbVariant.id);

        const currentPrice = Number(dbVariant.price_override ?? dbProd.price);
        const physicalStock = Number(dbVariant.stock_quantity);
        const reservedStock = Number(dbVariant.reserved_quantity ?? 0);
        if (!Number.isFinite(currentPrice) || currentPrice < 0 ||
            !Number.isFinite(physicalStock) || !Number.isFinite(reservedStock) ||
            physicalStock < 0 || reservedStock < 0) {
          hasStockError = true;
          stockErrorMessage = `Unable to verify price or stock for "${item.product.name}". Please try again.`;
          return item;
        }
        const availableStock = Math.max(0, physicalStock - reservedStock);

        if (availableStock < item.quantity) {
          hasStockError = true;
          stockErrorMessage = `Insufficient stock for "${item.product.name}". Only ${availableStock} unit(s) available.`;
        }

        if (currentPrice !== item.product.price) {
          priceChangeMessages.push(
            `Price for "${item.product.name}" was updated from ₹${item.product.price.toLocaleString(
              'en-IN'
            )} to ₹${currentPrice.toLocaleString('en-IN')}.`
          );
        }

        authoritativeSubtotal += currentPrice * item.quantity;

        return {
          ...item,
          variantId: dbVariant.id,
          product: {
            ...item.product,
            price: currentPrice,
          },
          stockAvailable: availableStock,
        };
      });

      return {
        isValid: !hasStockError,
        hasPriceChanges: priceChangeMessages.length > 0,
        hasStockError,
        priceChangeMessages: priceChangeMessages.length > 0 ? priceChangeMessages : undefined,
        stockErrorMessage: stockErrorMessage || undefined,
        authoritativeSubtotal,
        validatedItems,
      };
    } catch (error) {
      console.error('Checkout catalog validation failed:', error);
      return {
        isValid: false,
        hasPriceChanges: false,
        hasStockError: true,
        stockErrorMessage: 'We could not verify current prices and stock. Please try again.',
        authoritativeSubtotal: 0,
        validatedItems: [],
      };
    }
  },

  /**
   * Create an Order with immutable address and product snapshots
   * Supports Guest and Authenticated Customers
   */
  async createOrder(params: {
    userId?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    shippingAddress: CustomerAddress;
    billingAddress?: CustomerAddress;
    items: CartItem[];
    paymentMethod: 'online' | 'cod';
    couponCode?: string;
    notes?: string;
  }): Promise<{ success: boolean; orderId?: string; orderNumber?: string; guestAccessToken?: string; error?: string }> {
    const { userId, customerName, customerEmail, customerPhone, shippingAddress, billingAddress, items, paymentMethod, couponCode, notes } = params;

    // Idempotency lock
    const lockKey = `${userId || customerEmail || 'guest'}-${items.map((i) => `${i.product.id}:${i.variantId || 'missing-variant'}:${i.quantity}`).join(',')}`;
    if (activeSubmissionLocks.has(lockKey)) {
      return { success: false, error: 'An order request is already processing. Please wait a moment.' };
    }
    activeSubmissionLocks.add(lockKey);

    try {
      // 1. Authoritative validation
      const validation = await this.validateCheckoutCart(items);
      if (!validation.isValid || validation.hasStockError) {
        return {
          success: false,
          error: validation.stockErrorMessage || 'Unable to create order due to stock constraints.',
        };
      }

      // 2. Attempt server-authoritative order creation endpoint
      const normalizedShipping = {
        ...shippingAddress,
        pincode: shippingAddress.pincode || (shippingAddress as any).postalCode || '560001',
      };
      const normalizedBilling = billingAddress
        ? {
            ...billingAddress,
            pincode: billingAddress.pincode || (billingAddress as any).postalCode || normalizedShipping.pincode,
          }
        : normalizedShipping;

      try {
        let token = '';
        if (isSupabaseConfigured() && userId) {
          const { data } = await supabase.auth.getSession();
          token = data.session?.access_token || '';
        }

        const serverResponse = await fetch('/api/orders/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            items: validation.validatedItems,
            shippingAddress: normalizedShipping,
            billingAddress: normalizedBilling,
            paymentMethod,
            couponCode: couponCode?.trim().toUpperCase() || undefined,
            customerName: customerName || normalizedShipping.recipientName,
            customerEmail: customerEmail || normalizedShipping.email,
            customerPhone: customerPhone || normalizedShipping.phone,
            notes,
          }),
        });

        const srvData = await serverResponse.json().catch(() => ({}));
        if (!serverResponse.ok || !srvData.success || !srvData.orderId) {
          return {
            success: false,
            error: srvData.error || 'The order service could not create your order. Please try again.',
          };
        }

        if (paymentMethod === 'cod') {
          cartService.clearGuestCart();
        }
        return {
          success: true,
          orderId: srvData.orderId,
          orderNumber: srvData.orderNumber,
          guestAccessToken: srvData.guestAccessToken,
        };
      } catch (srvErr) {
        console.error('Backend order creation request failed:', srvErr);
        return {
          success: false,
          error: 'Unable to reach the order service. No order was created. Please try again.',
        };
      }

    } catch (err: any) {
      return { success: false, error: err?.message || 'Unexpected error creating order.' };
    } finally {
      activeSubmissionLocks.delete(lockKey);
    }
  },

  /**
   * Fetch customer orders from Supabase (scoped to auth.uid())
   */
  async getCustomerOrders(userId: string): Promise<OrderData[]> {
    if (!isSupabaseConfigured() || !userId) {
      try {
        const stored = localStorage.getItem(`vk_orders_${userId}`);
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    }

    try {
      const { data, error } = await (supabase as any)
        .from('orders')
        .select(`
          *,
          items:order_items(*),
          payments:payments(id,order_id,provider,provider_order_id,provider_payment_id,amount,currency,status,method,verified_at,created_at)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map((ord: any) => {
        const paymentRecord = Array.isArray(ord.payments) ? ord.payments[0] : ord.payments;
        return {
          id: ord.id,
          orderNumber: ord.order_number,
          userId: ord.user_id,
          shippingAddressSnapshot: ord.shipping_address_snapshot,
          billingAddressSnapshot: ord.billing_address_snapshot,
          subtotal: Number(ord.subtotal),
          discountAmount: Number(ord.discount_amount || 0),
          shippingAmount: Number(ord.shipping_amount || 0),
          taxAmount: Number(ord.tax_amount || 0),
          totalAmount: Number(ord.total_amount),
          currency: ord.currency || 'INR',
          paymentStatus: ord.payment_status,
          orderStatus: ord.order_status,
          refundStatus: ord.refund_status || 'not_applicable',
          cancelledAt: ord.cancelled_at || null,
          cancellationReason: ord.cancellation_reason || '',
          courierName: ord.courier_name || '',
          trackingNumber: ord.tracking_number || '',
          trackingUrl: ord.tracking_url || '',
          shippedAt: ord.shipped_at || null,
          deliveredAt: ord.delivered_at || null,
          paymentMethod: paymentRecord?.provider === 'cod' ? 'cod' : 'online',
          payment: paymentRecord
            ? {
                id: paymentRecord.id,
                orderId: paymentRecord.order_id,
                provider: paymentRecord.provider,
                providerOrderId: paymentRecord.provider_order_id,
                providerPaymentId: paymentRecord.provider_payment_id,
                amount: Number(paymentRecord.amount),
                currency: paymentRecord.currency,
                status: paymentRecord.status,
                method: paymentRecord.method,
                verifiedAt: paymentRecord.verified_at,
                createdAt: paymentRecord.created_at,
              }
            : undefined,
          notes: ord.notes,
          createdAt: ord.created_at,
          items: (ord.items || []).map((i: any) => ({
            id: i.id,
            orderId: i.order_id,
            productVariantId: i.product_variant_id,
            productName: i.product_name_snapshot,
            sku: i.sku_snapshot,
            price: Number(i.price_snapshot),
            quantity: i.quantity,
            totalAmount: Number(i.total_amount),
            productMetadata: i.product_metadata_snapshot || {},
            primaryImage: normalizeImageUrl(
              i.product_metadata_snapshot?.primaryImage ||
              '/src/assets/images/hero_vastram_saree_1791192126882.jpg'
            ),
          })),
        };
      });
    } catch {
      return [];
    }
  },

  /**
   * Get single order by ID (Supports guest orders and server-side privileged lookup)
   */
  async getOrderById(
    orderId: string,
    userId?: string,
    guestAccessToken?: string
  ): Promise<OrderData | null> {
    const resolvedGuestToken =
      guestAccessToken ||
      (typeof window !== 'undefined'
        ? sessionStorage.getItem(`vk_guest_token_${orderId}`) || ''
        : '');

    // 1. Try server-side lookup first (works seamlessly for guests and patrons)
    try {
      let token = '';
      if (isSupabaseConfigured() && userId) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token || '';
      }

      const res = await fetch(`/api/orders/${orderId}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(resolvedGuestToken ? { 'x-guest-token': resolvedGuestToken } : {}),
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.order) {
          return data.order;
        }
      }
    } catch {
      // ignore network errors and fallback
    }

    if (!isSupabaseConfigured()) {
      const orders = await this.getCustomerOrders(userId || '');
      const foundInUser = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
      if (foundInUser) return foundInUser;

      const guests = JSON.parse(localStorage.getItem('vk_all_guest_orders') || '[]');
      const foundGuest = guests.find((o: any) => o.id === orderId || o.orderNumber === orderId);
      if (foundGuest) {
        // Enforce guest access token check if set
        if (
          foundGuest.guestAccessToken &&
          resolvedGuestToken &&
          foundGuest.guestAccessToken !== resolvedGuestToken
        ) {
          return null;
        }
        return foundGuest;
      }
      return null;
    }

    return null;
  },

  /**
   * Link any previous guest orders matching the email to the authenticated user account
   */
  async linkGuestOrders(userId: string, email: string): Promise<number> {
    try {
      let token = '';
      if (isSupabaseConfigured()) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token || '';
      }

      const res = await fetch('/api/customer/link-guest-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId, email }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.linkedCount || 0;
      }
    } catch (e) {
      console.warn('Failed to call /api/customer/link-guest-orders:', e);
    }

    // Merge in localStorage simulation
    try {
      const guestOrders = JSON.parse(localStorage.getItem('vk_all_guest_orders') || '[]');
      const matching = guestOrders.filter((o: any) => o.customerEmail?.toLowerCase() === email.toLowerCase());
      if (matching.length > 0) {
        const userOrders = JSON.parse(localStorage.getItem(`vk_orders_${userId}`) || '[]');
        matching.forEach((m: any) => {
          if (!userOrders.some((u: any) => u.id === m.id)) {
            userOrders.unshift({ ...m, userId, isGuest: false });
          }
        });
        localStorage.setItem(`vk_orders_${userId}`, JSON.stringify(userOrders));
        return matching.length;
      }
    } catch {
      // ignore
    }

    return 0;
  },

  /**
   * Fetch all orders for Store Administrator
   */
  async getAllOrdersForAdmin(): Promise<OrderData[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    try {
      const { data, error } = await (supabase as any)
        .from('orders')
        .select(`
          *,
          items:order_items(*),
          payments:payments(id,order_id,provider,provider_order_id,provider_payment_id,amount,currency,status,method,verified_at,created_at)
        `)
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map((ord: any) => {
        const paymentRecord = Array.isArray(ord.payments) ? ord.payments[0] : ord.payments;
        return {
          id: ord.id,
          orderNumber: ord.order_number,
          userId: ord.user_id,
          shippingAddressSnapshot: ord.shipping_address_snapshot,
          billingAddressSnapshot: ord.billing_address_snapshot,
          subtotal: Number(ord.subtotal),
          discountAmount: Number(ord.discount_amount || 0),
          shippingAmount: Number(ord.shipping_amount || 0),
          taxAmount: Number(ord.tax_amount || 0),
          totalAmount: Number(ord.total_amount),
          currency: ord.currency || 'INR',
          paymentStatus: ord.payment_status,
          orderStatus: ord.order_status,
          refundStatus: ord.refund_status || 'not_applicable',
          cancelledAt: ord.cancelled_at || null,
          cancellationReason: ord.cancellation_reason || '',
          courierName: ord.courier_name || '',
          trackingNumber: ord.tracking_number || '',
          trackingUrl: ord.tracking_url || '',
          shippedAt: ord.shipped_at || null,
          deliveredAt: ord.delivered_at || null,
          paymentMethod: paymentRecord?.provider === 'cod' ? 'cod' : 'online',
          payment: paymentRecord
            ? {
                id: paymentRecord.id,
                orderId: paymentRecord.order_id,
                provider: paymentRecord.provider,
                providerOrderId: paymentRecord.provider_order_id,
                providerPaymentId: paymentRecord.provider_payment_id,
                amount: Number(paymentRecord.amount),
                currency: paymentRecord.currency,
                status: paymentRecord.status,
                method: paymentRecord.method,
                verifiedAt: paymentRecord.verified_at,
                createdAt: paymentRecord.created_at,
              }
            : undefined,
          notes: ord.notes,
          createdAt: ord.created_at,
          items: (ord.items || []).map((i: any) => ({
            id: i.id,
            orderId: i.order_id,
            productName: i.product_name_snapshot,
            sku: i.sku_snapshot,
            price: Number(i.price_snapshot),
            quantity: i.quantity,
            totalAmount: Number(i.total_amount),
            productMetadata: i.product_metadata_snapshot || {},
            primaryImage: normalizeImageUrl(i.product_metadata_snapshot?.primaryImage),
          })),
        };
      });
    } catch {
      return [];
    }
  },

  /**
   * Cancel an order and release reserved inventory
   */
  async cancelOrder(
    orderId: string,
    userId?: string,
    guestAccessToken?: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      let token = '';
      if (isSupabaseConfigured() && userId) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token || '';
      }
      const resolvedGuestToken =
        guestAccessToken ||
        (typeof window !== 'undefined'
          ? sessionStorage.getItem(`vk_guest_token_${orderId}`) || ''
          : '');

      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(resolvedGuestToken ? { 'x-guest-token': resolvedGuestToken } : {}),
        },
      });

      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error cancelling order.' };
    }
  },
};
