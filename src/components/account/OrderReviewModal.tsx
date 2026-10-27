import React, { useEffect, useState } from 'react';
import { X, Star } from 'lucide-react';
import { orderReviewService, ReviewFormData } from '../../services/orderReviewService';

interface OrderReviewModalProps {
  orderNumber: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

/** Row of five stars. Keyboard accessible: each star is a radio-style button. */
export const StarPicker: React.FC<{ label: string; value: number; onChange: (value: number) => void }> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between gap-3 py-2">
    <span className="text-sm text-[#1C1917]">{label}</span>
    <div role="radiogroup" aria-label={`${label} rating`} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          onClick={() => onChange(star)}
          className="p-1 cursor-pointer"
        >
          <Star className={`w-5 h-5 ${star <= value ? 'fill-[#B88E3E] text-[#B88E3E]' : 'text-[#D6CFC2]'}`} />
        </button>
      ))}
    </div>
  </div>
);

export const OrderReviewModal: React.FC<OrderReviewModalProps> = ({ orderNumber, onClose, onSubmitted }) => {
  const [form, setForm] = useState<ReviewFormData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [packagingRating, setPackagingRating] = useState(0);
  const [productRatings, setProductRatings] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    orderReviewService.getReviewForm(orderNumber).then((result) => {
      if (!active) return;
      if (result.success && result.form) setForm(result.form);
      else setLoadError(result.error || 'Could not load the review form.');
    });
    return () => { active = false; };
  }, [orderNumber]);

  const pendingProducts = form?.products.filter((p) => !p.alreadyReviewed) || [];

  const submit = async () => {
    if (!form) return;
    if (!deliveryRating || !packagingRating) {
      setMessage({ type: 'error', text: 'Please rate delivery and packaging.' });
      return;
    }
    const missing = pendingProducts.find((p) => !productRatings[p.productId]);
    if (missing) {
      setMessage({ type: 'error', text: `Please rate ${missing.name}.` });
      return;
    }
    if (feedback.trim().length < 10) {
      setMessage({ type: 'error', text: 'Please write a few words of feedback (at least 10 characters).' });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    const result = await orderReviewService.submitReview(orderNumber, {
      deliveryRating,
      packagingRating,
      feedback: feedback.trim(),
      productRatings: pendingProducts.map((p) => ({ productId: p.productId, rating: productRatings[p.productId] })),
    });
    setSubmitting(false);
    if (result.success) {
      setMessage({ type: 'ok', text: result.message || 'Thank you for your review.' });
      onSubmitted?.();
    } else {
      setMessage({ type: 'error', text: result.error || 'Could not save your review.' });
    }
  };

  const alreadyDone = form?.submitted;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-[#1C1917]/60 p-0 sm:p-6" role="dialog" aria-modal="true" aria-label={`Review order ${orderNumber}`}>
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-[#FAF8F5] shadow-xl">
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3 border-b border-[#1C1917]/10">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#B88E3E]">Share your experience</p>
            <h2 className="font-serif text-xl text-[#1C1917] mt-1">Order {orderNumber}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-[#57534E] hover:text-[#1C1917] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-6">
          {loadError && <p className="text-sm text-[#78281F]">{loadError}</p>}
          {!form && !loadError && <p className="text-sm text-[#78716C]">Loading...</p>}

          {form && alreadyDone && (
            <p className="text-sm text-[#57534E]">You have already reviewed this order. Thank you for sharing your experience.</p>
          )}

          {form && !alreadyDone && (
            <>
              <section aria-labelledby="ratings-heading">
                <h3 id="ratings-heading" className="text-xs uppercase tracking-[0.15em] text-[#78716C] mb-2">Your ratings</h3>
                <div className="divide-y divide-[#1C1917]/10">
                  <StarPicker label="Delivery" value={deliveryRating} onChange={setDeliveryRating} />
                  <StarPicker label="Packaging" value={packagingRating} onChange={setPackagingRating} />
                  {pendingProducts.map((p) => (
                    <StarPicker
                      key={p.productId}
                      label={p.name}
                      value={productRatings[p.productId] || 0}
                      onChange={(value) => setProductRatings((current) => ({ ...current, [p.productId]: value }))}
                    />
                  ))}
                </div>
                {form.products.some((p) => p.alreadyReviewed) && (
                  <p className="text-xs text-[#78716C] mt-2">Products you have already reviewed are not shown again.</p>
                )}
              </section>

              <section aria-labelledby="feedback-heading">
                <h3 id="feedback-heading" className="text-xs uppercase tracking-[0.15em] text-[#78716C] mb-2">Your feedback</h3>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={5}
                  maxLength={2000}
                  placeholder="How did the pieces feel, look and arrive? Your words will appear under each product you bought."
                  className="w-full bg-white border border-[#1C1917]/15 p-3 text-sm text-[#1C1917] focus:outline-none focus:border-[#B88E3E]"
                />
                <p className="text-[11px] text-[#78716C] text-right">{feedback.length}/2000</p>
              </section>

              {message && (
                <p role="status" className={`text-sm ${message.type === 'ok' ? 'text-[#2F5D3A]' : 'text-[#78281F]'}`}>{message.text}</p>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="w-full bg-[#78281F] text-[#FAF8F5] py-3 text-sm tracking-[0.12em] uppercase disabled:opacity-60 cursor-pointer"
              >
                {submitting ? 'Publishing...' : 'Publish review'}
              </button>
            </>
          )}
          {message && alreadyDone && <p className="text-sm text-[#2F5D3A]">{message.text}</p>}
        </div>
      </div>
    </div>
  );
};
