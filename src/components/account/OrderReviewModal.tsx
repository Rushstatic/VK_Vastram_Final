import React, { useEffect, useState } from 'react';
import { X, Star } from 'lucide-react';
import { orderReviewService } from '../../services/orderReviewService';
import { buildReviewShareLink } from '../../lib/reviewShare';

interface OrderReviewModalProps {
  orderNumber: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

/** Five stars, keyboard accessible. Shared by the account page and the emailed review page. */
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
          <Star className={`w-6 h-6 ${star <= value ? 'fill-[#B88E3E] text-[#B88E3E]' : 'text-[#D6CFC2]'}`} />
        </button>
      ))}
    </div>
  </div>
);

/** One overall rating and one written review for the whole order. */
export const OrderReviewModal: React.FC<OrderReviewModalProps> = ({ orderNumber, onClose, onSubmitted }) => {
  const [loading, setLoading] = useState(true);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [savedShare, setSavedShare] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    orderReviewService.getReviewForm(orderNumber).then((result) => {
      if (!active) return;
      setLoading(false);
      if (result.success && result.form) setAlreadyDone(Boolean(result.form.submitted));
      else setLoadError(result.error || 'Could not load the review.');
    });
    return () => { active = false; };
  }, [orderNumber]);

  const submit = async () => {
    if (!rating) return setMessage('Please choose a star rating.');
    if (feedback.trim().length < 10) return setMessage('Please write a few words (at least 10 characters).');
    setSubmitting(true);
    setMessage('');
    const result = await orderReviewService.submitReview(orderNumber, {
      rating,
      feedback: feedback.trim(),
    });
    setSubmitting(false);
    if (result.success) {
      setSavedShare(buildReviewShareLink(rating, feedback));
      onSubmitted?.();
    } else {
      setMessage(result.error || 'Could not save your review.');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-[#1C1917]/60 p-0 sm:p-6" role="dialog" aria-modal="true" aria-label={`Review order ${orderNumber}`}>
      <div className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-[#FAF8F5] shadow-xl">
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3 border-b border-[#1C1917]/10">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#B88E3E]">Share your experience</p>
            <h2 className="font-serif text-xl text-[#1C1917] mt-1">Order {orderNumber}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-[#57534E] hover:text-[#1C1917] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {loading && <p className="text-sm text-[#78716C]">Loading...</p>}
          {loadError && <p className="text-sm text-[#78281F]">{loadError}</p>}

          {!loading && !loadError && alreadyDone && !savedShare && (
            <p className="text-sm text-[#57534E]">Thank you, you have already shared your experience for this order.</p>
          )}

          {savedShare && (
            <div className="text-center space-y-4 py-4">
              <p className="font-serif text-xl text-[#1C1917]">Thank you for your review</p>
              <p className="text-sm text-[#57534E]">Would you like to share it with friends on WhatsApp?</p>
              <a href={savedShare} target="_blank" rel="noopener noreferrer" className="inline-block w-full bg-[#25D366] text-white py-3 text-sm tracking-[0.1em] uppercase">
                Share on WhatsApp
              </a>
            </div>
          )}

          {!loading && !loadError && !alreadyDone && !savedShare && (
            <>
              <section>
                <h3 className="text-xs uppercase tracking-[0.15em] text-[#78716C] mb-2">How was your experience?</h3>
                <StarPicker label="Overall" value={rating} onChange={setRating} />
              </section>
              <section>
                <label htmlFor="review-feedback" className="text-xs uppercase tracking-[0.15em] text-[#78716C]">Your review</label>
                <textarea
                  id="review-feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={5}
                  maxLength={2000}
                  placeholder="Tell us how the pieces feel, look and arrived."
                  className="mt-2 w-full bg-white border border-[#1C1917]/15 p-3 text-sm text-[#1C1917] focus:outline-none focus:border-[#B88E3E]"
                />
                <p className="text-[11px] text-[#78716C] text-right">{feedback.length}/2000</p>
              </section>
              {message && <p role="status" className="text-sm text-[#78281F]">{message}</p>}
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
        </div>
      </div>
    </div>
  );
};
