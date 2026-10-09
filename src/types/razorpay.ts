export interface RazorpayPrefill {
  name?: string;
  email?: string;
  contact?: string;
}

export interface RazorpayTheme {
  color?: string;
  backdrop_color?: string;
  hide_topbar?: boolean;
}

export interface RazorpayModalOptions {
  backdropclose?: boolean;
  escape?: boolean;
  handleback?: boolean;
  confirm_close?: boolean;
  ondismiss?: () => void;
  animation?: boolean;
}

export interface RazorpayOrderCreationResponse {
  success: boolean;
  keyId: string;
  razorpayOrderId: string;
  amount: number; // in paise
  currency: string;
  orderNumber: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: Record<string, string>;
  isTestMode?: boolean;
  error?: string;
}

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayFailureResponse {
  error: {
    code: string;
    description: string;
    source: string;
    step: string;
    reason: string;
    metadata: {
      order_id: string;
      payment_id: string;
    };
  };
}

export interface RazorpayCheckoutOptions {
  key: string;
  amount: number; // in paise
  currency: string;
  name: string;
  description?: string;
  image?: string;
  order_id: string;
  handler?: (response: RazorpaySuccessResponse) => void;
  prefill?: RazorpayPrefill;
  notes?: Record<string, string>;
  theme?: RazorpayTheme;
  modal?: RazorpayModalOptions;
}

export interface RazorpayInstance {
  open: () => void;
  on: (event: string, callback: (response: any) => void) => void;
  close: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}
