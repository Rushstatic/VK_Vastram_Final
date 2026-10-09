import React, { useState, useEffect, useRef } from 'react';
import { gsap, ScrollTrigger } from '../../lib/gsap';

interface ScrollRevealProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  distance?: number;
  className?: string;
  threshold?: number;
  once?: boolean;
}

export const ScrollReveal: React.FC<ScrollRevealProps> = ({
  children,
  delay = 0,
  duration = 750,
  direction = 'up',
  distance = 20,
  className = '',
  threshold = 0.12,
  once = true,
}) => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);

      const handleChange = (e: MediaQueryListEvent) => {
        setPrefersReducedMotion(e.matches);
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    if (prefersReducedMotion) {
      gsap.set(el, { opacity: 1, x: 0, y: 0, clearProps: 'all' });
      return;
    }

    // Determine initial transform vectors
    let startX = 0;
    let startY = 0;
    if (direction === 'up') startY = distance;
    if (direction === 'down') startY = -distance;
    if (direction === 'left') startX = distance;
    if (direction === 'right') startX = -distance;

    // Use gsap.context for React 19 safety & automatic cleanup
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        {
          autoAlpha: 0,
          x: startX,
          y: startY,
        },
        {
          autoAlpha: 1,
          x: 0,
          y: 0,
          duration: duration / 1000,
          delay: delay / 1000,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: `top ${Math.round((1 - threshold) * 100)}%`,
            toggleActions: once ? 'play none none none' : 'play reverse play reverse',
            once,
          },
        }
      );
    }, elementRef);

    return () => {
      ctx.revert();
    };
  }, [direction, distance, duration, delay, threshold, once, prefersReducedMotion]);

  return (
    <div
      ref={elementRef}
      className={className}
      style={{
        // Initially hide with autoAlpha equivalent until GSAP kicks in or if reduced motion
        opacity: prefersReducedMotion ? 1 : 0,
        visibility: prefersReducedMotion ? 'visible' : 'hidden',
        willChange: prefersReducedMotion ? 'auto' : 'transform, opacity',
      }}
    >
      {children}
    </div>
  );
};

