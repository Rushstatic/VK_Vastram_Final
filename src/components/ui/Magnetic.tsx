import React, { useEffect, useRef } from 'react';
import { gsap } from '../../lib/gsap';

/** Wraps a child so it gently follows the cursor on hover (desktop pointers only). */
export const Magnetic: React.FC<{ children: React.ReactNode; strength?: number; className?: string }> = ({
  children, strength = 0.25, className = '',
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia('(hover: hover) and (pointer: fine)').matches ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const move = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      gsap.to(el, { x: (e.clientX - (r.left + r.width / 2)) * strength, y: (e.clientY - (r.top + r.height / 2)) * strength, duration: 0.35, ease: 'power3.out' });
    };
    const leave = () => gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('mousemove', move);
    el.addEventListener('mouseleave', leave);
    return () => { el.removeEventListener('mousemove', move); el.removeEventListener('mouseleave', leave); gsap.killTweensOf(el); };
  }, [strength]);

  return <div ref={ref} className={`inline-block ${className}`}>{children}</div>;
};
