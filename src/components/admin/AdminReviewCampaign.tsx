import React from 'react';

/** Admin shortcut: the public review link to share with customers and their families. Always open. */
export const AdminReviewCampaign: React.FC = () => {
  const publicLink = typeof window !== 'undefined' ? `${window.location.origin}/review` : '/review';
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    await navigator.clipboard?.writeText(publicLink).catch(() => undefined);
    setCopied(true);
  };
  return (
    <section className="bg-[#F4EFE6] border border-[#1C1917]/10 p-5 mb-6">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[#967029] font-semibold">Customer review link</p>
      <p className="mt-2 font-mono text-sm break-all">{publicLink}</p>
      <p className="mt-2 text-xs text-[#57534E]">Anyone with this link can write a review. Share it on WhatsApp with customers and their families.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="px-4 py-2 bg-[#1C1917] text-[#FAF8F5] text-xs uppercase tracking-wider cursor-pointer">
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(`Share your experience with VK VASTRAM: ${publicLink}`)}`} target="_blank" rel="noopener noreferrer"
          className="px-4 py-2 border border-[#25D366] text-[#128C4B] text-xs uppercase tracking-wider">
          Send on WhatsApp
        </a>
      </div>
    </section>
  );
};
