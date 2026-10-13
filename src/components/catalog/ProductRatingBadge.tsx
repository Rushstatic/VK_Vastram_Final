import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { reviewService } from '../../services/reviewService';

const ratingCache = new Map<string, { average: number; count: number }>();

export const ProductRatingBadge: React.FC<{ productId: string; className?: string; showEmpty?: boolean }> = ({ productId, className = '', showEmpty = false }) => {
  const [summary, setSummary] = useState(ratingCache.get(productId) || null);
  useEffect(() => {
    let active = true;
    const load = async (force = false) => {
      const cached = ratingCache.get(productId);
      if (cached && !force) { setSummary(cached); return; }
      try {
        const reviews = await reviewService.getProductReviews(productId);
        if (!active) return;
        if (!reviews.length) { ratingCache.delete(productId); setSummary(null); return; }
        const average = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length;
        const result = { average, count: reviews.length };
        ratingCache.set(productId, result);
        setSummary(result);
      } catch { if (active) setSummary(null); }
    };
    void load();
    const onReviewsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ productId?: string }>).detail;
      if (detail?.productId === productId) void load(true);
    };
    window.addEventListener('vk-reviews-updated', onReviewsUpdated);
    return () => { active = false; window.removeEventListener('vk-reviews-updated', onReviewsUpdated); };
  }, [productId]);

  if (!summary || summary.count < 1) return showEmpty ? <span className={`text-[11px] text-[#78716C] ${className}`}>No customer reviews yet</span> : null;
  return <div className={`inline-flex items-center gap-1 text-[10px] text-[#785A18] ${className}`} aria-label={`${summary.average.toFixed(1)} out of 5 from ${summary.count} reviews`}>
    <Star className="w-3 h-3 fill-[#B88E3E] text-[#B88E3E]" />
    <span className="font-semibold">{summary.average.toFixed(1)}</span>
    <span className="text-[#78716C]">({summary.count})</span>
  </div>;
};
