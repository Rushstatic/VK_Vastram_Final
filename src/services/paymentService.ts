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
      if (typeof window === 'undefined') {
        resolve(false);
        return;
      }

      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }

      const existingScript = document.getElementById('razorpay-checkout-script') as HTMLScriptElement | null;
      if (existingScript) {
        if ((window as any).Razorpay) {
          resolve(true);
          return;
        }
        existingScript.addEventListener('load', () => resolve(Boolean((window as any).Razorpay)));
        existingScript.addEventListener('error', () => resolve(false));

        // Polling fallback in case load event already fired before listener attached
        let attempts = 0;
        const checkInterval = setInterval(() => {
          attempts++;
          if ((window as any).Razorpay) {
            clearInterval(checkInterval);
            resolve(true);
          } else if (attempts > 30) {
            clearInterval(checkInterval);
            resolve(false);
          }
        }, 100);
        return;
      }

      const script = document.createElement('script');
      script.id = 'razorpay-checkout-script';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(Boolean((window as any).Razorpay));
      script.onerror = () => {
        console.error('Failed to load Razorpay Checkout SDK');
        resolve(false);
      };
      document.body.appendChild(script);

      // Timeout fallback
      setTimeout(() => {
        if ((window as any).Razorpay) {
          resolve(true);
        }
      }, 3000);
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
      options.onError?.(new Error('Razorpay Checkout SDK could not be loaded.'));
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
      console.error('Error opening Razorpay checkout:', err);
      options.onError?.(err);
      return false;
    }
  },
};
