import React, { useEffect, useState } from 'react';
import { StarPicker } from '../account/OrderReviewModal';

interface LinkForm {
  orderNumber: string;
  firstName: string;
  submitted: boolean;
  products: Array<{ productId: string; name: string; quantity: number }>;
}

/**
 * Public review page opened from the "Share your experience" email. No login needed: the
 * private token in the address identifies the order (works for guest checkout too).
 */
export const ReviewLinkPage: React.FC<{ token: string }> = ({ token }) => {
  const [form, setForm] = useState<LinkForm | null>(null);
  const [error, setError] = useState('');
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [packagingRating, setPackagingRating] = useState(0);
  const [productRatings, setProductRatings] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    fetch(`/api/review-links/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (data.success) setForm(data);
        else setError(data.error || 'This review link is invalid or has expired.');
      })
      .catch(() => active && setError('Could not load your order. Check your connection and try again.'));
    return () => { active = false; };
  }, [token]);

  const submit = async () => {
    if (!form) return;
    if (!deliveryRating || !packagingRating) return setMessage('Please rate delivery and packaging.');
    const missing = form.products.find((p) => !productRatings[p.productId]);
    if (missing) return setMessage(`Please rate ${missing.name}.`);
    if (feedback.trim().length < 10) return setMessage('Please write a few words of feedback (at least 10 characters).');
    setSubmitting(true);
    setMessage('');
    try {
      const response = await fetch(`/api/review-links/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryRating,
          packagingRating,
          feedback: feedback.trim(),
          productRatings: form.products.map((p) => ({ productId: p.productId, rating: productRatings[p.productId] })),
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) setDone(data.message || 'Thank you for your review.');
      else setMessage(data.error || 'Could not save your review. Please try again.');
    } catch {
      setMessage('Could not save your review. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1C1917]">
      <header className="border-b border-[#1C1917]/10 py-5 text-center">
        <a href="/" className="font-serif tracking-[0.3em] text-lg text-[#78281F] uppercase">VK VASTRAM</a>
      </header>
      <main className="max-w-xl mx-auto px-5 py-10">
        {!form && !error && <p className="text-sm text-[#78716C] text-center">Loading your order...</p>}
        {error && (
          <div className="text-center py-12">
            <h1 className="font-serif text-2xl">This link can't be used</h1>
            <p className="mt-3 text-sm text-[#57534E]">{error}</p>
            <a href="/" className="inline-block mt-6 text-sm underline text-[#967029]">Continue shopping</a>
          </div>
        )}

        {form && done && (
          <div className="text-center py-12">
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#B88E3E]">Thank you</p>
            <h1 className="font-serif text-3xl mt-3">{done}</h1>
            <p className="mt-4 text-sm text-[#57534E]">Your words help other people choose with confidence.</p>
            <a href="/" className="inline-block mt-8 px-6 py-3 bg-[#78281F] text-[#FAF8F5] text-sm tracking-[0.12em] uppercase">Back to VK VASTRAM</a>
          </div>
        )}

        {form && !done && form.submitted && (
          <div className="text-center py-12">
            <h1 className="font-serif text-2xl">You have already shared your experience</h1>
            <p className="mt-3 text-sm text-[#57534E]">Thank you for reviewing order {form.orderNumber}.</p>
          </div>
        )}

        {form && !done && !form.submitted && (
          <>
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#B88E3E] text-center">Order {form.orderNumber}</p>
            <h1 className="font-serif text-3xl text-center mt-2">{form.firstName ? `${form.firstName}, how did we do?` : 'How did we do?'}</h1>
            <p className="text-center text-sm text-[#57534E] mt-3">Rate each part of your order, then tell us about it in your own words.</p>

            <section className="mt-8 divide-y divide-[#1C1917]/10 border-y border-[#1C1917]/10">
              <StarPicker label="Delivery" value={deliveryRating} onChange={setDeliveryRating} />
              <StarPicker label="Packaging" value={packagingRating} onChange={setPackagingRating} />
              {form.products.map((p) => (
                <StarPicker
                  key={p.productId}
                  label={p.name}
                  value={productRatings[p.productId] || 0}
                  onChange={(value) => setProductRatings((c) => ({ ...c, [p.productId]: value }))}
                />
              ))}
            </section>

            <section className="mt-8">
              <label htmlFor="feedback" className="text-xs uppercase tracking-[0.15em] text-[#78716C]">Your feedback</label>
              <textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder="How did the pieces feel, look and arrive? Your words will appear under each product you bought."
                className="mt-2 w-full bg-white border border-[#1C1917]/15 p-3 text-sm focus:outline-none focus:border-[#B88E3E]"
              />
              <p className="text-[11px] text-[#78716C] text-right">{feedback.length}/2000</p>
            </section>

            {message && <p role="status" className="mt-4 text-sm text-[#78281F]">{message}</p>}
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="mt-6 w-full bg-[#78281F] text-[#FAF8F5] py-3.5 text-sm tracking-[0.14em] uppercase disabled:opacity-60 cursor-pointer"
            >
              {submitting ? 'Publishing...' : 'Publish my review'}
            </button>
          </>
        )}
      </main>
    </div>
  );
};
