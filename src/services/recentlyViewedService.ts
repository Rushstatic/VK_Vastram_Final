import { Product } from '../types';

const STORAGE_KEY = 'vk_recently_viewed_products';
const MAX_RECENTLY_VIEWED = 10;

interface StoredViewItem {
  id: string;
  slug: string;
  viewedAt: number;
}

export const recentlyViewedService = {
  /**
   * Records a product view (moves to front, deduplicates, max 10)
   */
  recordView(product: { id: string; slug: string }): void {
    if (typeof window === 'undefined' || !product?.id) return;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      let list: StoredViewItem[] = raw ? JSON.parse(raw) : [];

      // Filter out existing occurrence
      list = list.filter((item) => item.id !== product.id && item.slug !== product.slug);

      // Prepend newest view
      list.unshift({
        id: product.id,
        slug: product.slug,
        viewedAt: Date.now(),
      });

      // Clamp to max 10
      if (list.length > MAX_RECENTLY_VIEWED) {
        list = list.slice(0, MAX_RECENTLY_VIEWED);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Could not record recently viewed item:', e);
    }
  },

  /**
   * Retrieves ordered list of recently viewed products from active catalogue
   */
  getRecentlyViewed(allProducts: Product[], excludeSlug?: string): Product[] {
    if (typeof window === 'undefined' || !allProducts || allProducts.length === 0) {
      return [];
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];

      const list: StoredViewItem[] = JSON.parse(raw);
      if (!Array.isArray(list)) return [];

      const result: Product[] = [];

      for (const item of list) {
        if (excludeSlug && item.slug === excludeSlug) continue;

        const match = allProducts.find(
          (p) => (p.id === item.id || p.slug === item.slug) && p.status !== 'archived'
        );

        if (match && !result.some((r) => r.id === match.id)) {
          result.push(match);
        }
      }

      return result.slice(0, MAX_RECENTLY_VIEWED);
    } catch {
      return [];
    }
  },

  /**
   * Clear recently viewed items
   */
  clear(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
};
