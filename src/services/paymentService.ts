import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  RazorpayCheckoutOptions,
  RazorpayOrderCreationResponse,
  RazorpaySuccessResponse,
} from '../types/razorpay';

export interface PaymentVerificationResult {
  success: boolean;
  verified: boolean;
  orderId?: string;
  orderNumber?: string;
  error?: string;
}

export const paymentService = {
  /**
   * Load the official Razorpay Checkout SDK script dynamically
   */
  loadRazorpayScript(): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') { resolve(false); return; }
      if ((window as any).Razorpay) { resolve(true); return; }

      const scriptId = 'razorpay-checkout-script';
      const scriptUrl = 'https://checkout.razorpay.com/v1/checkout.js';
      let existing = document.getElementById(scriptId) as HTMLScriptElement | null;

      // A previous failed <script> stays in the DOM and otherwise poisons every retry.
      if (existing && existing.dataset.loadState === 'failed') {
        existing.remove();
        existing = null;
      }

      const attach = (script: HTMLScriptElement) => {
        let settled = false;
        const finish = (loaded: boolean) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          script.removeEventListener('load', onLoad);
          script.removeEventListener('error', onError);
          if (loaded && (window as any).Razorpay) {
            script.dataset.loadState = 'loaded';
            resolve(true);
          } else {
            script.dataset.loadState = 'failed';
            script.remove();
            resolve(false);
          }
        };
        const onLoad = () => finish(Boolean((window as any).Razorpay));
        const onError = () => finish(false);
        script.addEventListener('load', onLoad, { once: true });
        script.addEventListener('error', onError, { once: true });
        const timeout = window.setTimeout(() => finish(Boolean((window as any).Razorpay)), 10000);
        // Covers a script that completed just before listeners were attached.
        if ((window as any).Razorpay) finish(true);
      };

      if (existing) {
        attach(existing);
        return;
      }

      const script = document.createElement('script');
      script.id = scriptId;
      script.src = scriptUrl;
      script.async = true;
      script.dataset.loadState = 'loading';
      attach(script);
      document.head.appendChild(script);
    });
  },

  /**
   * Get public payment configuration
   */
  async getPaymentConfig(): Promise<{ keyId: string; isTestMode: boolean }> {
    try {
      const res = await fetch('/api/payment/config');
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.warn('Unable to fetch payment config from backend, checking client env');
    }

    const clientKey =
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_RAZORPAY_KEY_ID) ||
      '';
    return { keyId: clientKey, isTestMode: true };
  },

  /**
   * Create Razorpay Order via secure server-side endpoint
   */
  async createRazorpayOrder(
    orderId: string,
    guestAccessToken?: string
  ): Promise<RazorpayOrderCreationResponse> {
    try {
      // Get current Supabase Auth access token
      let token = '';
      if (isSupabaseConfigured()) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token || '';
      }

      const resolvedGuestToken =
        guestAccessToken ||
        (typeof window !== 'undefined'
          ? window.sessionStorage?.getItem(`vk_guest_token_${orderId}`) || ''
          : '');

      const response = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(resolvedGuestToken ? { 'x-guest-token': resolvedGuestToken } : {}),
        },
        body: JSON.stringify({
          orderId,
          ...(resolvedGuestToken ? { guestAccessToken: resolvedGuestToken } : {}),
        }),
      });

      const data = await response.json();
      return data;
    } catch (err: any) {
      console.error('Error calling /api/payment/create-order:', err);
      return {
        success: false,
        keyId: '',
        razorpayOrderId: '',
        amount: 0,
        currency: 'INR',
        orderNumber: '',
        error: err?.message || 'Network error initiating Razorpay order.',
      };
    }
  },

  /**
   * Send Razorpay signature to server for authoritative cryptographic verification
   */
  async verifyPayment(params: {
    orderId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    guestAccessToken?: string;
  }): Promise<PaymentVerificationResult> {
    try {
      let token = '';
      if (isSupabaseConfigured()) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token || '';
      }

      const resolvedGuestToken =
        params.guestAccessToken ||
        (typeof window !== 'undefined'
          ? window.sessionStorage?.getItem(`vk_guest_token_${params.orderId}`) || ''
          : '');

      const response = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(resolvedGuestToken ? { 'x-guest-token': resolvedGuestToken } : {}),
        },
        body: JSON.stringify({
          ...params,
          ...(resolvedGuestToken ? { guestAccessToken: resolvedGuestToken } : {}),
        }),
      });

      const data = await response.json();
      return data;
    } catch (err: any) {
      console.error('Error calling /api/payment/verify:', err);
      return {
        success: false,
        verified: false,
        error: err?.message || 'Network error verifying payment with server.',
      };
    }
  },

  /**
   * Persist a gateway-reported failure against the existing internal order.
   * The server verifies ownership and the Razorpay order association.
   */
  async recordPaymentFailure(params: {
    orderId: string;
    razorpayOrderId: string;
    code?: string;
    description?: string;
    source?: string;
    guestAccessToken?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      let token = '';
      if (isSupabaseConfigured()) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token || '';
      }
      const guestToken = params.guestAccessToken ||
        (typeof window !== 'undefined' ? window.sessionStorage?.getItem(`vk_guest_token_${params.orderId}`) || '' : '');
      const response = await fetch('/api/payment/failure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(guestToken ? { 'x-guest-token': guestToken } : {}),
        },
        body: JSON.stringify({ ...params, ...(guestToken ? { guestAccessToken: guestToken } : {}) }),
      });
      const data = await response.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Could not record payment failure.' };
    }
  },

  /**
   * The customer closed the payment window without paying. Releases the stock hold and cancels
   * the unpaid online order right away. The server first checks that no payment was actually taken.
   */
  async abandonUnpaidOrder(params: { orderId: string; guestAccessToken?: string }): Promise<{
    success: boolean;
    abandoned?: boolean;
    paid?: boolean;
    deferred?: boolean;
    error?: string;
  }> {
    try {
      let token = '';
      if (isSupabaseConfigured()) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token || '';
      }
      const guestToken = params.guestAccessToken ||
        (typeof window !== 'undefined' ? window.sessionStorage?.getItem(`vk_guest_token_${params.orderId}`) || '' : '');
      const response = await fetch('/api/payment/abandon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(guestToken ? { 'x-guest-token': guestToken } : {}),
        },
        body: JSON.stringify({ orderId: params.orderId, ...(guestToken ? { guestAccessToken: guestToken } : {}) }),
      });
      return await response.json();
    } catch (err: any) {
      return { success: false, error: err?.message || 'Could not release the unpaid order.' };
    }
  },

  /**
   * Open the official Razorpay Checkout modal
   */
  async openRazorpayCheckout(options: {
    keyId: string;
    razorpayOrderId: string;
    amount: number; // paise
    currency: string;
    orderNumber: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    storeName?: string;
    notes?: Record<string, string>;
    onSuccess: (res: RazorpaySuccessResponse) => void;
    onDismiss?: () => void;
    onError?: (err: any) => void;
  }): Promise<boolean> {
    const isLoaded = await this.loadRazorpayScript();
    if (!isLoaded || !window.Razorpay) {
      // No checkout was opened, so this is an SDK/network initialization failure,
      // not a gateway-declined payment. Keep the existing order pending for retry.
      console.error('Razorpay Checkout SDK could not be loaded; preserving pending order.');
      return false;
    }

    try {
      const checkoutOptions: RazorpayCheckoutOptions = {
        key: options.keyId,
        amount: options.amount,
        currency: options.currency || 'INR',
        name: options.storeName || 'VK VASTRAM',
        description: `Order #${options.orderNumber}`,
        image: '/favicon.ico',
        order_id: options.razorpayOrderId,
        handler: (response: RazorpaySuccessResponse) => {
          options.onSuccess(response);
        },
        prefill: {
          name: options.customerName || '',
          email: options.customerEmail || '',
          contact: options.customerPhone || '',
        },
        notes: options.notes || {
          orderNumber: options.orderNumber,
        },
        theme: {
          color: '#800020', // Classical Royal Burgundy
          backdrop_color: 'rgba(28, 25, 23, 0.6)',
        },
        modal: {
          confirm_close: true,
          ondismiss: () => {
            options.onDismiss?.();
          },
        },
      };

      const razorpayInstance = new window.Razorpay(checkoutOptions);
      razorpayInstance.on('payment.failed', (response: any) => {
        console.warn('Razorpay payment failed in checkout modal:', response);
        options.onError?.(response.error);
      });

      razorpayInstance.open();
      return true;
    } catch (err) {
      console.error('Error initializing Razorpay checkout; preserving pending order:', err);
      return false;
    }
  },
};
