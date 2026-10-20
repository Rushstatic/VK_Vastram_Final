import React, { useEffect, useRef } from 'react';
import { gsap } from '../../lib/gsap';

/** Small gold line that draws itself in when scrolled into view. */
export const GoldRule: React.FC<{ className?: string }> = ({ className = '' }) => {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(el, { scaleX: 1 });
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      gsap.to(el, { scaleX: 1, duration: 0.9, ease: 'power3.out' });
      io.disconnect();
    }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={`block h-px w-12 bg-[#B88E3E] origin-left ${className}`}
      style={{ transform: 'scaleX(0)' }}
    />
  );
};
