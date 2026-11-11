import React, { useEffect, useState } from 'react';

/**
 * Public "Write a review" page for the shareable link. A customer enters their order number and the
 * email or phone used at checkout. Only a matching, delivered order can be reviewed.
 */
export const ReviewLookupPage: React.FC = () => {
  const [open, setOpen] = useState<boolean | null>(null);
  const [orderNumber, setOrderNumber] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/review-campaign/status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => active && setOpen(Boolean(data.open)))
      .catch(() => active && setOpen(false));
    return () => { active = false; };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/review-campaign/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, contact }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.path) {
        window.location.assign(data.path);
        return;
      }
      setMessage(data.error || 'Something went wrong. Please try again.');
    } catch {
      setMessage('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1C1917]">
      <header className="border-b border-[#1C1917]/10 py-5 text-center">
        <a href="/" className="font-serif tracking-[0.3em] text-lg text-[#78281F] uppercase">VK VASTRAM</a>
      </header>
      <main className="max-w-md mx-auto px-5 py-12">
        <p className="text-[10px] uppercase tracking-[0.25em] text-[#B88E3E] text-center">Share your experience</p>
        <h1 className="font-serif text-3xl text-center mt-3">Write a review</h1>

        {open === null && <p className="mt-8 text-sm text-center text-[#78716C]">Loading...</p>}

        {open === false && (
          <p className="mt-8 text-sm text-center text-[#57534E]">
            Reviews are not open right now. Thank you for your interest. Please check back soon.
          </p>
        )}

        {open === true && (
          <form onSubmit={submit} className="mt-8 space-y-5">
            <p className="text-sm text-center text-[#57534E]">
              Enter the order number from your confirmation and the email or phone number you used at checkout.
            </p>
            <div>
              <label htmlFor="order-number" className="text-xs uppercase tracking-[0.15em] text-[#78716C]">Order number</label>
              <input
                id="order-number"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="VKV-202610-XXXXXX"
                autoComplete="off"
                required
                className="mt-2 w-full bg-white border border-[#1C1917]/15 p-3 text-sm font-mono focus:outline-none focus:border-[#B88E3E]"
              />
            </div>
            <div>
              <label htmlFor="contact" className="text-xs uppercase tracking-[0.15em] text-[#78716C]">Email or phone used at checkout</label>
              <input
                id="contact"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                autoComplete="email"
                required
                className="mt-2 w-full bg-white border border-[#1C1917]/15 p-3 text-sm focus:outline-none focus:border-[#B88E3E]"
              />
            </div>
            {message && <p role="status" className="text-sm text-[#78281F]">{message}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-[#78281F] text-[#FAF8F5] py-3.5 text-sm tracking-[0.14em] uppercase disabled:opacity-60 cursor-pointer"
            >
              {busy ? 'Checking...' : 'Continue'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
};
