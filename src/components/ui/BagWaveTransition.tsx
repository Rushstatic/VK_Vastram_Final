import React from 'react';
import { Check, ShoppingBag } from 'lucide-react';

interface BagWaveTransitionProps {
  onComplete: () => void;
}

/** Full-screen, bottom-to-top liquid-silk confirmation after a successful bag add. */
export const BagWaveTransition: React.FC<BagWaveTransitionProps> = ({ onComplete }) => (
  <div
    className="vk-bag-wave"
    role="status"
    aria-live="polite"
    aria-label="Item added to your shopping bag"
    onAnimationEnd={(event) => {
      if (event.target === event.currentTarget) onComplete();
    }}
  >
    <div className="vk-bag-wave__surface" aria-hidden="true">
      <svg className="vk-bag-wave__edge" viewBox="0 0 1440 170" preserveAspectRatio="none">
        <path
          className="vk-bag-wave__maroon-edge"
          d="M0 104 C170 34 285 150 470 92 S760 44 920 98 S1220 140 1440 62 L1440 170 L0 170 Z"
        />
        <path
          className="vk-bag-wave__gold-edge"
          d="M0 94 C170 24 285 140 470 82 S760 34 920 88 S1220 130 1440 52"
        />
      </svg>
      <div className="vk-bag-wave__message">
        <span className="vk-bag-wave__mark">
          <ShoppingBag className="vk-bag-wave__bag-icon" size={25} strokeWidth={1.35} />
          <Check className="vk-bag-wave__check-icon" size={12} strokeWidth={2.2} />
        </span>
        <span className="vk-bag-wave__eyebrow">VK VASTRAM</span>
        <span className="vk-bag-wave__title">Added to your bag</span>
        <span className="vk-bag-wave__subtitle">A beautiful choice.</span>
      </div>
    </div>
  </div>
);
