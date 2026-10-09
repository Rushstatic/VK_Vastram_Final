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
      const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
      return {
        isValid: true,
        hasPriceChanges: false,
        hasStockError: false,
        authoritativeSubtotal: subtotal,
        validatedItems: items,
      };
    }

    try {
      const productIds = Array.from(new Set(items.map((i) => i.product.id)));
      const { data: dbProducts } = await (supabase as any)
        .from('products')
        .select(`
          id,
          name,
          price,
          status,
          variants:product_variants(id, sku, price_override, stock_quantity, reserved_quantity, is_active)
        `)
        .in('id', productIds);

      const priceChangeMessages: string[] = [];
      let hasStockError = false;
      let stockErrorMessage = '';
      let authoritativeSubtotal = 0;

      const validatedItems: CartItem[] = items.map((item) => {
        const dbProd = dbProducts?.find((p: any) => p.id === item.product.id);
        if (!dbProd || dbProd.status === 'archived') {
          hasStockError = true;
          stockErrorMessage = `"${item.product.name}" is no longer available in catalog.`;
          return item;
        }

        // Find relevant variant
        const dbVariant = dbProd.variants?.find((v: any) =>
          item.variantId ? v.id === item.variantId : true
        );

        const currentPrice = Number(dbVariant?.price_override || dbProd.price || item.product.price);
        const physicalStock = Number(dbVariant?.stock_quantity ?? 10);
        const reservedStock = Number(dbVariant?.reserved_quantity ?? 0);
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
    } catch {
      const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
      return {
        isValid: true,
        hasPriceChanges: false,
        hasStockError: false,
        authoritativeSubtotal: subtotal,
        validatedItems: items,
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
    notes?: string;
  }): Promise<{ success: boolean; orderId?: string; orderNumber?: string; guestAccessToken?: string; error?: string }> {
    const { userId, customerName, customerEmail, customerPhone, shippingAddress, billingAddress, items, paymentMethod, notes } = params;

    // Idempotency lock
    const lockKey = `${userId || customerEmail || 'guest'}-${items.map((i) => `${i.product.id}:${i.quantity}`).join(',')}`;
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
            items,
            shippingAddress: normalizedShipping,
            billingAddress: normalizedBilling,
            paymentMethod,
            customerName: customerName || normalizedShipping.recipientName,
            customerEmail: customerEmail || normalizedShipping.email,
            customerPhone: customerPhone || normalizedShipping.phone,
            notes,
          }),
        });

        if (serverResponse.ok) {
          const srvData = await serverResponse.json();
          if (srvData.success && srvData.orderId) {
            if (paymentMethod === 'cod') {
              cartService.clearGuestCart();
            }
            return {
              success: true,
              orderId: srvData.orderId,
              orderNumber: srvData.orderNumber,
              guestAccessToken: srvData.guestAccessToken,
            };
          }
        }
      } catch (srvErr) {
        console.warn('Backend /api/orders/create call fell back to direct client insertion:', srvErr);
      }

      const subtotal = validation.authoritativeSubtotal;
      const shippingAmount = 0; // Neutral shipping foundation (finalized during delivery configuration)
      const taxAmount = 0; // Tax calculation foundation
      const discountAmount = 0;
      const totalAmount = subtotal + shippingAmount + taxAmount - discountAmount;

      const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
      const randomSeq = Math.floor(1000 + Math.random() * 9000);
      const generatedOrderNumber = `VKV-${dateStr}-${randomSeq}`;
      const generatedGuestToken = !userId ? Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join('') : undefined;

      if (!isSupabaseConfigured()) {
        // Local simulation fallback
        const mockOrderId = `ord-${Date.now()}`;
        const mockOrder: OrderData = {
          id: mockOrderId,
          orderNumber: generatedOrderNumber,
          userId,
          customerName: customerName || normalizedShipping.recipientName,
          customerEmail: customerEmail || normalizedShipping.email,
          customerPhone: customerPhone || normalizedShipping.phone,
          isGuest: !userId,
          shippingAddressSnapshot: { ...normalizedShipping, guestAccessToken: generatedGuestToken },
          billingAddressSnapshot: { ...normalizedBilling, guestAccessToken: generatedGuestToken },
          subtotal,
          discountAmount,
          shippingAmount,
          taxAmount,
          totalAmount,
          currency: 'INR',
          paymentStatus: 'pending',
          orderStatus: paymentMethod === 'cod' ? 'confirmed' : 'pending',
          paymentMethod,
          notes,
          items: items.map((i) => ({
            productName: i.product.name,
            sku: i.product.sku || i.product.slug,
            price: i.product.price,
            quantity: i.quantity,
            totalAmount: i.product.price * i.quantity,
            primaryImage: i.product.primaryImage,
            productMetadata: {
              color: i.selectedColor,
              size: i.selectedSize,
              category: i.product.categoryLabel,
            },
          })),
          createdAt: new Date().toISOString(),
        };

        const storageKey = userId ? `vk_orders_${userId}` : 'vk_orders_guest';
        const existingMockOrders = JSON.parse(localStorage.getItem(storageKey) || '[]');
        existingMockOrders.unshift(mockOrder);
        localStorage.setItem(storageKey, JSON.stringify(existingMockOrders));

        if (!userId) {
          const allGuests = JSON.parse(localStorage.getItem('vk_all_guest_orders') || '[]');
          allGuests.unshift(mockOrder);
          localStorage.setItem('vk_all_guest_orders', JSON.stringify(allGuests));
        }

        if (paymentMethod === 'cod') {
          cartService.clearGuestCart();
        }
        return {
          success: true,
          orderId: mockOrderId,
          orderNumber: generatedOrderNumber,
          guestAccessToken: generatedGuestToken,
        };
      }

      // 3. Insert into public.orders
      const completeShippingSnapshot = {
        ...normalizedShipping,
        ...(generatedGuestToken ? { guestAccessToken: generatedGuestToken } : {}),
      };
      const completeBillingSnapshot = {
        ...normalizedBilling,
        ...(generatedGuestToken ? { guestAccessToken: generatedGuestToken } : {}),
      };

      const { data: createdOrder, error: orderError } = await (supabase as any)
        .from('orders')
        .insert({
          user_id: userId || null,
          customer_name: customerName || normalizedShipping.recipientName || null,
          customer_email: customerEmail || normalizedShipping.email || null,
          customer_phone: customerPhone || normalizedShipping.phone || null,
          is_guest: !userId,
          order_number: generatedOrderNumber,
          shipping_address_snapshot: completeShippingSnapshot,
          billing_address_snapshot: completeBillingSnapshot,
          subtotal,
          discount_amount: discountAmount,
          shipping_amount: shippingAmount,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          currency: 'INR',
          payment_status: 'pending',
          order_status: paymentMethod === 'cod' ? 'confirmed' : 'pending',
          notes: notes || null,
        })
        .select('id, order_number')
        .single();

      if (orderError || !createdOrder) {
        return { success: false, error: orderError?.message || 'Database error creating order.' };
      }

      const orderId = createdOrder.id;

      // 4. Insert into public.order_items (immutable snapshots)
      const orderItemRows = items.map((item) => ({
        order_id: orderId,
        product_variant_id: item.variantId || null,
        product_name_snapshot: item.product.name,
        sku_snapshot: item.product.sku || item.product.slug,
        price_snapshot: item.product.price,
        quantity: item.quantity,
        total_amount: item.product.price * item.quantity,
        product_metadata_snapshot: {
          color: item.selectedColor || null,
          size: item.selectedSize || null,
          category: item.product.categoryLabel || null,
          primaryImage: item.product.primaryImage || null,
        },
      }));

      const { error: itemsError } = await (supabase as any)
        .from('order_items')
        .insert(orderItemRows);

      if (itemsError) {
        return { success: false, error: itemsError.message || 'Error attaching order items.' };
      }

      // 5. Record initial payment record in public.payments
      await (supabase as any).from('payments').insert({
        order_id: orderId,
        provider: paymentMethod === 'cod' ? 'cod' : 'razorpay',
        amount: totalAmount,
        currency: 'INR',
        status: 'pending',
        method: paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment (Razorpay Pending)',
      });

      // 6. Convert/Clear active cart only if COD (online payment clears upon success)
      if (paymentMethod === 'cod') {
        if (userId) {
          const cartId = await cartService.getOrCreateUserCartId(userId);
          if (cartId) {
            await (supabase as any).from('cart_items').delete().eq('cart_id', cartId);
          }
        }
        cartService.clearGuestCart();
      }

      return {
        success: true,
        orderId,
        orderNumber: createdOrder.order_number,
        guestAccessToken: generatedGuestToken,
      };
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
          payments:payments(*)
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
          paymentMethod: paymentRecord?.provider === 'cod' ? 'cod' : 'online',
          payment: paymentRecord
            ? {
                id: paymentRecord.id,
                orderId: paymentRecord.order_id,
                provider: paymentRecord.provider,
                providerOrderId: paymentRecord.provider_order_id,
                providerPaymentId: paymentRecord.provider_payment_id,
                providerSignature: paymentRecord.provider_signature,
                amount: Number(paymentRecord.amount),
                currency: paymentRecord.currency,
                status: paymentRecord.status,
                method: paymentRecord.method,
                errorReason: paymentRecord.error_reason,
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
          payments:payments(*)
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
          paymentMethod: paymentRecord?.provider === 'cod' ? 'cod' : 'online',
          payment: paymentRecord
            ? {
                id: paymentRecord.id,
                orderId: paymentRecord.order_id,
                provider: paymentRecord.provider,
                providerOrderId: paymentRecord.provider_order_id,
                providerPaymentId: paymentRecord.provider_payment_id,
                providerSignature: paymentRecord.provider_signature,
                amount: Number(paymentRecord.amount),
                currency: paymentRecord.currency,
                status: paymentRecord.status,
                method: paymentRecord.method,
                errorReason: paymentRecord.error_reason,
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
