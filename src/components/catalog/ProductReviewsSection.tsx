import React, { useState, useEffect } from 'react';
import { Star, CheckCircle2, AlertCircle, MessageSquare } from 'lucide-react';
import { reviewService, ProductReview } from '../../services/reviewService';
import { Button } from '../ui/Button';

interface ProductReviewsSectionProps {
  productId: string;
  productName: string;
  className?: string;
}

export const ProductReviewsSection: React.FC<ProductReviewsSectionProps> = ({
  productId,
  productName,
  className = '',
}) => {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadReviews = async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const data = await reviewService.getProductReviews(productId);
      setReviews(Array.isArray(data) ? data : []);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await reviewService.submitReview({
        productId,
        rating,
        title: title.trim(),
        body: body.trim(),
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message || 'Thank you! Your verified review has been submitted for editorial moderation.',
        });
        setTitle('');
        setBody('');
        setRating(5);
        setShowForm(false);
        loadReviews();
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Review eligibility could not be verified. Reviews are exclusive to verified patrons with delivered orders.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'An unexpected error occurred while submitting your review.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const reviewCount = reviews.length;
  const avgRating = reviewCount > 0
    ? (reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0) / reviewCount).toFixed(1)
    : null;

  return (
    <section className={`pt-12 pb-8 border-t border-[#1C1917]/10 text-left ${className}`}>
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h3 className="font-serif text-2xl sm:text-3xl text-[#1C1917] font-normal">
            Customer Reviews
          </h3>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(!showForm)}
          leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
        >
          {showForm ? 'Cancel Review' : 'Write a Review'}
        </Button>
      </div>

      {/* Review Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xs border mb-6 text-xs flex items-start gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Expandable Review Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="p-6 bg-[#F4EFE6] rounded-xs border border-[#1C1917]/10 mb-8 space-y-4 max-w-xl"
        >
          <h4 className="font-serif text-lg text-[#1C1917]">
            Write a Review
          </h4>
          <p className="text-[11px] text-[#78716C]">
            Verified customer reviews are authenticated against completed orders.
          </p>

          {/* Star Rating Select */}
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-[#1C1917] mb-1.5">
              Rating *
            </label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  aria-label={`${star} star`}
                  className="p-1 text-[#B88E3E] hover:scale-110 transition-transform cursor-pointer"
                >
                  <Star
                    className={`w-5 h-5 ${star <= rating ? 'fill-[#B88E3E]' : 'text-stone-300'}`}
                  />
                </button>
              ))}
              <span className="text-xs font-semibold text-[#1C1917] ml-2">
                {rating} / 5 Stars
              </span>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-[#1C1917] mb-1">
              Headline / Title (Optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Masterful weave and lustrous gold zari"
              className="w-full bg-[#FAF8F5] border border-[#1C1917]/20 text-xs px-3 py-2 rounded-xs focus:outline-none focus:border-[#967029]"
            />
          </div>

          {/* Review Body */}
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-[#1C1917] mb-1">
              Your Review *
            </label>
            <textarea
              required
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe the drape, texture, craftsmanship, or packaging..."
              className="w-full bg-[#FAF8F5] border border-[#1C1917]/20 text-xs px-3 py-2 rounded-xs focus:outline-none focus:border-[#967029]"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={submitting || !body.trim()}
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </Button>
        </form>
      )}

      {/* Review List & Score Display */}
      {loading ? (
        <div className="py-8 text-center text-xs text-[#78716C] animate-pulse">
          Loading reviews...
        </div>
      ) : reviewCount === 0 ? (
        <div className="p-8 bg-[#F4EFE6]/50 rounded-xs border border-[#1C1917]/10 text-center my-4">
          <p className="font-serif text-lg text-[#1C1917] mb-1">
            No reviews yet
          </p>
          <p className="text-xs text-[#78716C] max-w-sm mx-auto">
            Be the first customer to share feedback after receiving your product.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Score */}
          <div className="flex items-center gap-4 pb-6 border-b border-[#1C1917]/10">
            <div className="text-4xl font-serif text-[#1C1917]">
              {avgRating}
            </div>
            <div>
              <div className="flex items-center gap-1 text-[#B88E3E]">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-4 h-4 ${
                      s <= Math.round(Number(avgRating) || 5)
                        ? 'fill-[#B88E3E]'
                        : 'text-stone-300'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-[#78716C] mt-0.5">
                Based on {reviewCount} verified {reviewCount === 1 ? 'review' : 'reviews'}
              </p>
            </div>
          </div>

          {/* Individual Reviews */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reviews.map((rev) => (
              <div
                key={rev.id}
                className="p-5 bg-[#FAF8F5] rounded-xs border border-[#1C1917]/10 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[#B88E3E]">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${
                          s <= rev.rating ? 'fill-[#B88E3E]' : 'text-stone-300'
                        }`}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-1 text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Verified Purchase</span>
                  </div>
                </div>

                {rev.title && (
                  <h5 className="font-serif text-sm font-semibold text-[#1C1917]">
                    {rev.title}
                  </h5>
                )}

                <p className="text-xs text-[#57534E] leading-relaxed">
                  {rev.body}
                </p>

                <div className="text-[11px] text-[#A8A29E] pt-1">
                  {rev.reviewerName || 'Valued Patron'} ·{' '}
                  {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
