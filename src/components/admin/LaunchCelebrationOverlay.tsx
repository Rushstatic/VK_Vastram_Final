import React, { useEffect } from 'react';

interface LaunchCelebrationOverlayProps {
  mode: 'preview' | 'official';
  onClose: () => void;
  onOpenStorefront: () => void;
}

const confettiPieces = Array.from({ length: 54 }, (_, index) => ({
  id: index,
  left: `${(index * 37) % 100}%`,
  delay: `${(index % 13) * -0.31}s`,
  duration: `${5.2 + (index % 7) * 0.42}s`,
  rotate: `${(index * 47) % 360}deg`,
  width: `${6 + (index % 4) * 2}px`,
  height: `${10 + (index % 5) * 2}px`,
  color: ['#B88E3E', '#F3D88D', '#78281F', '#F4EFE6', '#1F382B', '#D6B4A8'][index % 6],
}));

const celebratoryDoodles = [
  { symbol: '✦', left: '9%', top: '20%', delay: '0s', size: '2rem' },
  { symbol: '🌸', left: '16%', top: '68%', delay: '0.4s', size: '2.1rem' },
  { symbol: '✧', left: '83%', top: '19%', delay: '0.7s', size: '2.5rem' },
  { symbol: '🪷', left: '87%', top: '65%', delay: '0.2s', size: '2.2rem' },
  { symbol: '✨', left: '24%', top: '14%', delay: '1s', size: '1.7rem' },
  { symbol: '🎉', left: '76%', top: '76%', delay: '0.6s', size: '2rem' },
  { symbol: '✺', left: '7%', top: '48%', delay: '0.8s', size: '2rem' },
  { symbol: '✦', left: '91%', top: '43%', delay: '0.1s', size: '2.2rem' },
];

export const LaunchCelebrationOverlay: React.FC<LaunchCelebrationOverlayProps> = ({
  mode,
  onClose,
  onOpenStorefront,
}) => {
  useEffect(() => {
    const timeout = window.setTimeout(onClose, 16000);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="vk-launch-overlay fixed inset-0 z-[10000] flex items-center justify-center overflow-hidden px-5 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vk-launch-title"
    >
      <style>{`
        .vk-launch-overlay { background: radial-gradient(ellipse at 50% 38%, #4a3025 0%, #211b18 48%, #131110 100%); color: #FAF8F5; }
        .vk-launch-confetti { position: absolute; top: -24px; border-radius: 2px; opacity: 0; animation: vk-launch-fall var(--fall-duration) linear var(--fall-delay) infinite; transform: rotate(var(--fall-rotate)); }
        .vk-launch-doodle { position: absolute; animation: vk-launch-float 2.6s ease-in-out var(--doodle-delay) infinite alternate; filter: drop-shadow(0 4px 12px rgba(0,0,0,.24)); user-select: none; }
        .vk-launch-card { position: relative; z-index: 2; width: min(690px, 100%); padding: clamp(26px, 5vw, 54px); text-align: center; border: 1px solid rgba(212,177,103,.54); background: linear-gradient(145deg, rgba(250,248,245,.98), rgba(244,239,230,.97)); color: #1C1917; box-shadow: 0 30px 100px rgba(0,0,0,.42); animation: vk-launch-card-enter 900ms cubic-bezier(.18,.85,.25,1) both; }
        .vk-launch-seal { display: grid; place-items: center; width: 74px; height: 74px; margin: 0 auto 20px; border: 1px solid #B88E3E; border-radius: 50%; color: #78281F; box-shadow: inset 0 0 0 5px rgba(184,142,62,.1); font-family: Georgia,serif; font-size: 33px; animation: vk-launch-seal-turn 1.4s cubic-bezier(.2,.8,.2,1) both; }
        .vk-launch-rule { width: 88px; height: 2px; margin: 18px auto 20px; background: linear-gradient(90deg, transparent, #B88E3E, transparent); }
        @keyframes vk-launch-fall { 0% { opacity: 0; transform: translate3d(0,-5vh,0) rotate(var(--fall-rotate)); } 10% { opacity: 1; } 100% { opacity: .85; transform: translate3d(70px,110vh,0) rotate(calc(var(--fall-rotate) + 580deg)); } }
        @keyframes vk-launch-float { from { transform: translateY(-9px) rotate(-10deg) scale(.92); } to { transform: translateY(12px) rotate(12deg) scale(1.08); } }
        @keyframes vk-launch-card-enter { from { opacity: 0; transform: translateY(24px) scale(.96); filter: blur(6px); } to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); } }
        @keyframes vk-launch-seal-turn { from { opacity: 0; transform: rotate(-35deg) scale(.5); } to { opacity: 1; transform: rotate(0) scale(1); } }
        @media (prefers-reduced-motion: reduce) { .vk-launch-confetti, .vk-launch-doodle, .vk-launch-card, .vk-launch-seal { animation: none !important; } }
      `}</style>

      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {confettiPieces.map((piece) => (
          <span
            key={piece.id}
            className="vk-launch-confetti"
            style={{
              left: piece.left,
              width: piece.width,
              height: piece.height,
              background: piece.color,
              ['--fall-duration' as string]: piece.duration,
              ['--fall-delay' as string]: piece.delay,
              ['--fall-rotate' as string]: piece.rotate,
            } as React.CSSProperties}
          />
        ))}
        {celebratoryDoodles.map((doodle, index) => (
          <span
            key={`${doodle.symbol}-${index}`}
            className="vk-launch-doodle"
            style={{
              left: doodle.left,
              top: doodle.top,
              fontSize: doodle.size,
              ['--doodle-delay' as string]: doodle.delay,
            } as React.CSSProperties}
          >
            {doodle.symbol}
          </span>
        ))}
      </div>

      <div className="vk-launch-card">
        <div className="vk-launch-seal" aria-hidden="true">VK</div>
        <p className="text-[10px] sm:text-xs uppercase tracking-[0.32em] text-[#967029] font-semibold">
          {mode === 'preview' ? 'Launch celebration preview' : 'A new chapter begins'}
        </p>
        <h1 id="vk-launch-title" className="mt-3 font-serif text-4xl sm:text-6xl leading-[1.02] text-[#78281F]">
          {mode === 'preview' ? 'Your launch moment awaits.' : 'We are officially live.'}
        </h1>
        <div className="vk-launch-rule" />
        <p className="font-serif text-xl sm:text-2xl text-[#1C1917]">Celebrating {mode === 'preview' ? 'what’s about to begin at' : 'the launch of'} VK VASTRAM</p>
        <p className="mx-auto mt-4 max-w-lg text-sm sm:text-base leading-relaxed text-[#57534E]">
          Woven with tradition, made for the moments ahead. Here’s to beautiful beginnings, meaningful craft, and every customer who becomes part of our story.
        </p>
        <p className="mt-6 text-xs uppercase tracking-[0.2em] text-[#967029]">
          {mode === 'preview' ? 'Preview only · launch status remains unchanged' : 'A little celebration. A lasting beginning.'}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
          <button
            type="button"
            onClick={onOpenStorefront}
            className="inline-flex items-center justify-center rounded-sm bg-[#1C1917] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#78281F] focus:outline-none focus:ring-2 focus:ring-[#B88E3E] focus:ring-offset-2"
          >
            Open the storefront ↗
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-sm border border-[#1C1917]/20 px-6 py-3 text-sm font-medium text-[#1C1917] transition hover:bg-[#ECE5D8] focus:outline-none focus:ring-2 focus:ring-[#B88E3E] focus:ring-offset-2"
          >
            Finish celebration
          </button>
        </div>
      </div>
    </div>
  );
};
