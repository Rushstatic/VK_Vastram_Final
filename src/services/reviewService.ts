import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface ProductReview {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  title: string;
  body: string;
  status: 'pending' | 'approved' | 'rejected';
  verifiedPurchase: boolean;
  createdAt: string;
  reviewerName: string;
}

export interface SubmitReviewPayload {
  productId: string;
  rating: number;
  title: string;
  body: string;
}

export const reviewService = {
  /**
   * Fetch approved reviews for a specific product
   */
  async getProductReviews(productId: string): Promise<ProductReview[]> {
    try {
      const res = await fetch(`/api/products/${productId}/reviews?limit=50`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.reviews)) {
          return data.reviews;
        }
      }
    } catch (err) {
      console.warn('API review endpoint error, falling back to client query:', err);
    }

    // Client fallback if server route is unavailable
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await (supabase as any)
          .from('reviews')
          .select(`
            id,
            product_id,
            user_id,
            rating,
            title,
            body,
            status,
            created_at
          `)
          .eq('product_id', productId)
          .eq('status', 'approved')
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((rev: any) => ({
            id: rev.id,
            productId: rev.product_id,
            userId: rev.user_id,
            rating: rev.rating,
            title: rev.title,
            body: rev.body,
            status: rev.status,
            verifiedPurchase: false,
            createdAt: rev.created_at,
            reviewerName: 'Verified Patron',
          }));
        }
      } catch (clientErr) {
        console.error('Direct Supabase review fetch failed:', clientErr);
      }
    }

    return [];
  },

  /**
   * Submit a new customer review (verified purchase required)
   */
  async submitReview(
    payload: SubmitReviewPayload
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data?.session?.access_token;

      if (!token) {
        return {
          success: false,
          error: 'Please sign in to submit a patron review.',
        };
      }

      const res = await fetch('/api/reviews/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        return {
          success: true,
          message: data.message || 'Your review has been submitted and is awaiting curation.',
        };
      }

      return {
        success: false,
        error: data.error || 'Failed to submit review.',
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Network error while submitting review.',
      };
    }
  },

  /**
   * Admin: Get all reviews for moderation
   */
  async getAdminReviews(): Promise<{ success: boolean; reviews: ProductReview[]; error?: string }> {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data?.session?.access_token;

      const res = await fetch('/api/admin/reviews', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.ok) {
        const data = await res.json();
        return { success: true, reviews: data.reviews || [] };
      }
      return { success: false, reviews: [], error: 'Failed to load reviews' };
    } catch (err: any) {
      return { success: false, reviews: [], error: err.message };
    }
  },

  /**
   * Admin: Update review approval status
   */
  async updateReviewStatus(
    id: string,
    status: 'approved' | 'rejected' | 'pending'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data?.session?.access_token;

      const res = await fetch(`/api/admin/reviews/${id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        const data = await res.json();
        return { success: data.success, error: data.error };
      }
      return { success: false, error: 'Failed to update review status' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};
