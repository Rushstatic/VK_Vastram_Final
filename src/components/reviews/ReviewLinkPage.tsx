import React, { useEffect, useState } from 'react';

const MAX_PHOTOS = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
import { StarPicker } from '../account/OrderReviewModal';
import { buildReviewShareLink } from '../../lib/reviewShare';

/**
 * Review page opened from the "Share your experience" email. No login needed: the private
 * token in the address identifies the order (works for guest checkout too).
 */
export const ReviewLinkPage: React.FC<{ token: string }> = ({ token }) => {
  const [firstName, setFirstName] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [share, setShare] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Array<{ previewUrl: string; uploadedUrl?: string }>>([]);
  const [uploading, setUploading] = useState(false);

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const room = MAX_PHOTOS - photos.length;
    const chosen = Array.from(files).slice(0, room);
    for (const file of chosen) {
      if (!ACCEPTED.includes(file.type)) { setMessage('Please add JPEG, PNG or WebP photos.'); continue; }
      if (file.size > MAX_BYTES) { setMessage('Each photo must be 5 MB or smaller.'); continue; }
      const dataUrl = await readAsDataUrl(file);
      setUploading(true);
      try {
        const res = await fetch(`/api/review-links/${encodeURIComponent(token)}/photo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl, contentType: file.type }),
        });
        const data = await res.json();
        if (res.ok && data.success) setPhotos((current) => [...current, { previewUrl: dataUrl, uploadedUrl: data.url }]);
        else setMessage(data.error || 'Could not add that photo.');
      } catch {
        setMessage('Could not add that photo. Check your connection.');
      } finally {
        setUploading(false);
      }
    }
  };

  useEffect(() => {
    let active = true;
    fetch(`/api/review-links/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (data.success) {
          setFirstName(data.firstName || '');
          setOrderNumber(data.orderNumber || '');
          setAlreadySubmitted(Boolean(data.submitted));
          setLoaded(true);
        } else {
          setError(data.error || 'This review link is invalid or has expired.');
        }
      })
      .catch(() => active && setError('Could not load your order. Check your connection and try again.'));
    return () => { active = false; };
  }, [token]);

  const submit = async () => {
    if (!rating) return setMessage('Please choose a star rating.');
    if (feedback.trim().length < 10) return setMessage('Please write a few words (at least 10 characters).');
    setSubmitting(true);
    setMessage('');
    try {
      const response = await fetch(`/api/review-links/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, feedback: feedback.trim(), photoUrls: photos.map((p) => p.uploadedUrl).filter(Boolean) }),
      });
      const data = await response.json();
      if (response.ok && data.success) setShare(buildReviewShareLink(rating, feedback));
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
      <main className="max-w-md mx-auto px-5 py-10">
        {!loaded && !error && <p className="text-sm text-[#78716C] text-center">Loading...</p>}

        {error && (
          <div className="text-center py-12">
            <h1 className="font-serif text-2xl">This link can't be used</h1>
            <p className="mt-3 text-sm text-[#57534E]">{error}</p>
            <a href="/" className="inline-block mt-6 text-sm underline text-[#967029]">Continue shopping</a>
          </div>
        )}

        {loaded && share && (
          <div className="text-center py-10 space-y-4">
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#B88E3E]">Thank you</p>
            <h1 className="font-serif text-3xl">Your review is published</h1>
            <p className="text-sm text-[#57534E]">Thank you for sharing your experience with us.</p>
            <a href={share} target="_blank" rel="noopener noreferrer" className="block w-full bg-[#25D366] text-white py-3.5 text-sm tracking-[0.12em] uppercase">
              Share on WhatsApp
            </a>
            <a href="/" className="inline-block text-sm underline text-[#967029]">Back to VK VASTRAM</a>
          </div>
        )}

        {loaded && !share && alreadySubmitted && (
          <div className="text-center py-12">
            <h1 className="font-serif text-2xl">You have already shared your experience</h1>
            <p className="mt-3 text-sm text-[#57534E]">Thank you for reviewing order {orderNumber}.</p>
          </div>
        )}

        {loaded && !share && !alreadySubmitted && (
          <>
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#B88E3E] text-center">Order {orderNumber}</p>
            <h1 className="font-serif text-3xl text-center mt-2">{firstName ? `${firstName}, how did we do?` : 'How did we do?'}</h1>
            <p className="text-center text-sm text-[#57534E] mt-3">Give your overall rating and tell us about your order.</p>

            <section className="mt-8 border-y border-[#1C1917]/10 py-2 flex justify-center">
              <StarPicker label="Overall" value={rating} onChange={setRating} />
            </section>

            <section className="mt-8">
              <label htmlFor="feedback" className="text-xs uppercase tracking-[0.15em] text-[#78716C]">Your review</label>
              <textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder="How did the pieces feel, look and arrive?"
                className="mt-2 w-full bg-white border border-[#1C1917]/15 p-3 text-sm focus:outline-none focus:border-[#B88E3E]"
              />
              <p className="text-[11px] text-[#78716C] text-right">{feedback.length}/2000</p>
            </section>

            <section className="mt-8">
              <p className="text-xs uppercase tracking-[0.15em] text-[#78716C]">Add photos (optional, up to {MAX_PHOTOS})</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {photos.map((p, i) => (
                  <div key={i} className="relative w-20 h-20">
                    <img src={p.previewUrl} alt={`Your photo ${i + 1}`} className="w-full h-full object-cover border border-[#1C1917]/10" />
                    <button
                      type="button"
                      aria-label={`Remove photo ${i + 1}`}
                      onClick={() => setPhotos((current) => current.filter((_, idx) => idx !== i))}
                      className="absolute -top-2 -right-2 bg-[#1C1917] text-white w-6 h-6 rounded-full text-xs cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <label className={`w-20 h-20 border border-dashed border-[#967029]/60 flex items-center justify-center text-[#967029] text-xs text-center px-1 cursor-pointer ${uploading ? 'opacity-50' : ''}`}>
                    {uploading ? 'Adding...' : 'Add photo'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      disabled={uploading}
                      className="sr-only"
                      onChange={(e) => { void addPhotos(e.target.files); e.target.value = ''; }}
                    />
                  </label>
                )}
              </div>
            </section>

            {message && <p role="status" className="mt-4 text-sm text-[#78281F]">{message}</p>}
            <button
              type="button"
              onClick={submit}
              disabled={submitting || uploading}
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
