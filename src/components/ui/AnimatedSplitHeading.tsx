import React, { useEffect, useRef } from 'react';
import { gsap } from '../../lib/gsap';

interface AnimatedSplitHeadingProps {
  text: string;
  className?: string;
  tag?: 'h1' | 'h2' | 'h3';
}

/** Lightweight SplitText-inspired reveal using existing GSAP; no plugin or new dependency required. */
export const AnimatedSplitHeading: React.FC<AnimatedSplitHeadingProps> = ({ text, className = '', tag = 'h2' }) => {
  const ref = useRef<HTMLElement | null>(null);
  const Tag = tag;

  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const words = node.querySelectorAll<HTMLElement>('[data-split-word]');
    if (!words.length) return;

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      gsap.fromTo(words, { autoAlpha: 0, y: 10 }, {
        autoAlpha: 1,
        y: 0,
        duration: 0.55,
        stagger: 0.035,
        ease: 'power2.out',
        clearProps: 'transform',
      });
      observer.disconnect();
    }, { threshold: 0.2, rootMargin: '0px 0px -40px 0px' });

    observer.observe(node);
    return () => observer.disconnect();
  }, [text]);

  return (
    <Tag ref={(node) => { ref.current = node; }} className={className} aria-label={text}>
      {text.split(/(\s+)/).map((part, index) => part.trim()
        ? <span key={`${index}-${part}`} data-split-word className="inline-block" aria-hidden="true">{part}</span>
        : part)}
    </Tag>
  );
};
