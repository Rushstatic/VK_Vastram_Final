import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface ReviewFormProduct {
  productId: string;
  name: string;
  quantity: number;
  alreadyReviewed: boolean;
}

export interface ReviewFormData {
  orderNumber: string;
  submitted: boolean;
  products: ReviewFormProduct[];
}

const authHeaders = async (): Promise<Record<string, string>> => {
  if (!isSupabaseConfigured()) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const orderReviewService = {
  async getReviewForm(orderNumber: string): Promise<{ success: boolean; error?: string; form?: ReviewFormData }> {
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/review-form`, {
        headers: await authHeaders(),
      });
      const data = await response.json();
      if (!response.ok || !data.success) return { success: false, error: data.error || 'Could not load the review form.' };
      return { success: true, form: { orderNumber: data.orderNumber, submitted: data.submitted, products: data.products } };
    } catch {
      return { success: false, error: 'Could not load the review form. Check your connection and try again.' };
    }
  },

  async submitReview(
    orderNumber: string,
    payload: { deliveryRating: number; packagingRating: number; feedback: string; productRatings: Array<{ productId: string; rating: number }> }
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      return response.ok && data.success
        ? { success: true, message: data.message }
        : { success: false, error: data.error || 'Could not save your review.' };
    } catch {
      return { success: false, error: 'Could not save your review. Check your connection and try again.' };
    }
  },
};
