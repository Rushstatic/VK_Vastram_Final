import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface CampaignState { active: boolean; open: boolean; expiresAt: string | null; hours: number }

const authHeader = async (): Promise<Record<string, string>> => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** Admin control for the shareable review link: start a 48-hour window, or stop it at any time. */
export const AdminReviewCampaign: React.FC = () => {
  const [state, setState] = useState<CampaignState | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const publicLink = typeof window !== 'undefined' ? `${window.location.origin}/review` : '/review';

  const load = async () => {
    const res = await fetch('/api/admin/review-campaign', { headers: await authHeader() });
    const data = await res.json();
    if (res.ok && data.success) setState(data);
  };

  useEffect(() => { void load(); }, []);

  const act = async (action: 'start' | 'stop') => {
    setBusy(true);
    setNotice('');
    const res = await fetch('/api/admin/review-campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (res.ok && data.success) setState(data);
    else setNotice(data.error || 'Could not update the link.');
    setBusy(false);
  };

  const copy = async () => {
    await navigator.clipboard?.writeText(publicLink).catch(() => undefined);
    setNotice('Link copied. Share it on WhatsApp.');
  };

  return (
    <section className="bg-[#F4EFE6] border border-[#1C1917]/10 p-5 mb-6">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[#967029] font-semibold">Customer review link</p>
      <p className="mt-2 font-mono text-sm break-all">{publicLink}</p>
      <p className="mt-2 text-xs text-[#57534E]">
        {state?.open && state.expiresAt
          ? `Open until ${new Date(state.expiresAt).toLocaleString('en-IN')}. It closes automatically after ${state.hours} hours.`
          : 'Closed. Start it to let customers and their families write reviews for delivered orders.'}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {!state?.open ? (
          <button type="button" disabled={busy} onClick={() => act('start')}
            className="px-4 py-2 bg-[#1C1917] text-[#FAF8F5] text-xs uppercase tracking-wider disabled:opacity-50 cursor-pointer">
            Start 48-hour link
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => act('stop')}
            className="px-4 py-2 border border-[#78281F] text-[#78281F] text-xs uppercase tracking-wider disabled:opacity-50 cursor-pointer">
            Stop now
          </button>
        )}
        <button type="button" onClick={copy}
          className="px-4 py-2 border border-[#1C1917]/20 text-xs uppercase tracking-wider cursor-pointer">
          Copy link
        </button>
      </div>
      {notice && <p role="status" className="mt-3 text-xs text-[#57534E]">{notice}</p>}
    </section>
  );
};
