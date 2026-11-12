import React, { useState } from 'react';
import { StarPicker } from '../account/OrderReviewModal';
import { buildStoreShareLink } from '../../lib/reviewShare';

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

/** Public review page at /review. Anyone can write a review: no order, login or expiry. */
export const ReviewStorePage: React.FC = () => {
  const [name, setName] = useState('');
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [website, setWebsite] = useState(''); // hidden honeypot field for bots
  const [photos, setPhotos] = useState<Array<{ previewUrl: string; uploadedUrl: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files).slice(0, MAX_PHOTOS - photos.length)) {
      if (!ACCEPTED.includes(file.type)) { setMessage('Please add JPEG, PNG or WebP photos.'); continue; }
      if (file.size > MAX_BYTES) { setMessage('Each photo must be 5 MB or smaller.'); continue; }
      setUploading(true);
      try {
        const dataUrl = await readAsDataUrl(file);
        const res = await fetch('/api/store-reviews/photo', {
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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rating) return setMessage('Please choose a star rating.');
    if (feedback.trim().length < 10) return setMessage('Please write a few words (at least 10 characters).');
    setSubmitting(true);
    setMessage('');
    try {
      const res = await fetch('/api/store-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          rating,
          feedback: feedback.trim(),
          website,
          photoUrls: photos.map((p) => p.uploadedUrl),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) setDone(true);
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
      <main className="max-w-md mx-auto px-5 py-12">
        {done ? (
          <div className="text-center space-y-4">
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#B88E3E]">Thank you</p>
            <h1 className="font-serif text-3xl">Your review is published</h1>
            <p className="text-sm text-[#57534E]">We are grateful you took the time to share your experience.</p>
            <a href={buildStoreShareLink(rating, 1)} target="_blank" rel="noopener noreferrer" className="block w-full bg-[#25D366] text-white py-3.5 text-sm tracking-[0.12em] uppercase">
              Share on WhatsApp
            </a>
            <a href="/" className="inline-block text-sm underline text-[#967029]">Back to VK VASTRAM</a>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-6">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#B88E3E]">Share your experience</p>
              <h1 className="font-serif text-3xl mt-3">Write a review</h1>
            </div>

            <section className="flex justify-center border-y border-[#1C1917]/10 py-2">
              <StarPicker label="Your rating" value={rating} onChange={setRating} />
            </section>

            <div>
              <label htmlFor="review-name" className="text-xs uppercase tracking-[0.15em] text-[#78716C]">Your name (optional)</label>
              <input id="review-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60}
                className="mt-2 w-full bg-white border border-[#1C1917]/15 p-3 text-sm focus:outline-none focus:border-[#B88E3E]" />
            </div>

            <div>
              <label htmlFor="review-text" className="text-xs uppercase tracking-[0.15em] text-[#78716C]">Your review</label>
              <textarea id="review-text" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={5} maxLength={2000}
                placeholder="How did the pieces feel, look and arrive?"
                className="mt-2 w-full bg-white border border-[#1C1917]/15 p-3 text-sm focus:outline-none focus:border-[#B88E3E]" />
              <p className="text-[11px] text-[#78716C] text-right">{feedback.length}/2000</p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-[#78716C]">Add photos (optional, up to {MAX_PHOTOS})</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {photos.map((p, i) => (
                  <div key={i} className="relative w-20 h-20">
                    <img src={p.previewUrl} alt={`Your photo ${i + 1}`} className="w-full h-full object-cover border border-[#1C1917]/10" />
                    <button type="button" aria-label={`Remove photo ${i + 1}`}
                      onClick={() => setPhotos((current) => current.filter((_, idx) => idx !== i))}
                      className="absolute -top-2 -right-2 bg-[#1C1917] text-white w-6 h-6 rounded-full text-xs cursor-pointer">×</button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <label className={`w-20 h-20 border border-dashed border-[#967029]/60 flex items-center justify-center text-[#967029] text-xs text-center px-1 cursor-pointer ${uploading ? 'opacity-50' : ''}`}>
                    {uploading ? 'Adding...' : 'Add photo'}
                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} className="sr-only"
                      onChange={(e) => { void addPhotos(e.target.files); e.target.value = ''; }} />
                  </label>
                )}
              </div>
            </div>

            {/* Hidden from people; bots tend to fill it in. */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
              <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
            </div>

            {message && <p role="status" className="text-sm text-[#78281F]">{message}</p>}
            <button type="submit" disabled={submitting || uploading}
              className="w-full bg-[#78281F] text-[#FAF8F5] py-3.5 text-sm tracking-[0.14em] uppercase disabled:opacity-60 cursor-pointer">
              {submitting ? 'Publishing...' : 'Publish review'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
};
