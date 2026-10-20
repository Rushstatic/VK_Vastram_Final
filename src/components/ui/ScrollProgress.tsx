import React, { useEffect, useRef } from 'react';
import { gsap, ScrollTrigger } from '../../lib/gsap';

/** Thin gold reading-progress bar pinned to the top of the viewport, driven by GSAP ScrollTrigger. */
export const ScrollProgress: React.FC = () => {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const tween = gsap.to(bar, {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: { trigger: document.documentElement, start: 'top top', end: 'bottom bottom', scrub: 0.3 },
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, []);

  return (
    <div aria-hidden="true" className="fixed top-0 left-0 right-0 h-[2px] z-[60] pointer-events-none">
      <div ref={barRef} className="h-full w-full bg-[#B88E3E] origin-left" style={{ transform: 'scaleX(0)' }} />
    </div>
  );
};
