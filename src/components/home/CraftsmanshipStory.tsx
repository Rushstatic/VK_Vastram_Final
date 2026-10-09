import React, { useEffect, useRef } from 'react';
import { Container } from '../ui/Container';
import { CRAFT_IMAGE } from '../../data/catalog';
import { Button } from '../ui/Button';
import { ScrollReveal } from '../ui/ScrollReveal';
import { PageView } from '../../types';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { gsap, ScrollTrigger } from '../../lib/gsap';

interface CraftsmanshipStoryProps {
  onNavigate: (page: PageView) => void;
}

export const CraftsmanshipStory: React.FC<CraftsmanshipStoryProps> = ({
  onNavigate,
}) => {
  const { settings } = useSiteSettings();
  const storeName = settings?.storeName || 'VK VASTRAM';
  const sectionRef = useRef<HTMLElement>(null);
  const watermarkRef = useRef<HTMLSpanElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }
    }

    const sectionEl = sectionRef.current;
    if (!sectionEl) return;

    const ctx = gsap.context(() => {
      // Gentle parallax on watermark text
      if (watermarkRef.current) {
        gsap.fromTo(
          watermarkRef.current,
          { xPercent: -3 },
          {
            xPercent: 3,
            ease: 'none',
            scrollTrigger: {
              trigger: sectionEl,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 1.2,
            },
          }
        );
      }

      // Subtle vertical depth translation on the craft image container
      if (imageContainerRef.current) {
        gsap.fromTo(
          imageContainerRef.current,
          { y: 16 },
          {
            y: -16,
            ease: 'none',
            scrollTrigger: {
              trigger: sectionEl,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 1,
            },
          }
        );
      }
    }, sectionRef);

    return () => {
      ctx.revert();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative py-20 sm:py-28 bg-[#F4EFE6] border-y border-[#1C1917]/10 overflow-hidden"
    >
      {/* Background Editorial Typographic Watermark */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none flex items-center justify-center opacity-[0.035]">
        <span
          ref={watermarkRef}
          className="font-serif text-[11vw] tracking-[0.25em] font-light text-[#1C1917] uppercase whitespace-nowrap will-change-transform"
        >
          HERITAGE · CRAFT · WEAVE
        </span>
      </div>

      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center relative z-10">
          {/* Visual on the Left */}
          <div className="lg:col-span-6" ref={imageContainerRef}>
            <ScrollReveal direction="up" duration={700} distance={24}>
              <div className="relative rounded-xs overflow-hidden bg-[#EFE9DC] border border-[#1C1917]/10 shadow-xs group">
                <img
                  src={CRAFT_IMAGE}
                  alt="Traditional handloom weaving shuttle and threads"
                  className="w-full aspect-[4/3] object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                />
                <div className="p-4 sm:p-5 bg-[#FAF8F5] border-t border-[#1C1917]/10 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[#967029] font-medium">
                      The Loom Archive
                    </p>
                    <p className="font-serif text-sm text-[#1C1917]">
                      Traditional Pit Loom & Jacquard Brocade
                    </p>
                  </div>
                  <span className="text-xs text-[#78716C] font-serif italic">
                    Varanasi & Chanderi
                  </span>
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* Narrative on the Right */}
          <div className="lg:col-span-6 space-y-6">
            <ScrollReveal direction="up" delay={120} duration={700} distance={24}>
              <div className="inline-flex items-center gap-2 mb-4">
                <span className="w-6 h-[1px] bg-[#B88E3E]" />
                <span className="text-[11px] uppercase tracking-[0.25em] text-[#967029] font-medium">
                  Our Philosophy
                </span>
              </div>

              <h2 className="font-serif text-3xl sm:text-4xl text-[#1C1917] font-normal leading-tight text-balance mb-4">
                The Dignity of Generational Handloom Weaving.
              </h2>

              <p className="text-sm sm:text-base text-[#57534E] leading-relaxed font-normal mb-4">
                In an age of synthetic speed and mass printing, {storeName} stands for the patient rhythm of the authentic wooden loom. Every saree we present is woven thread-by-thread by skilled master artisans.
              </p>

              <p className="text-sm sm:text-base text-[#57534E] leading-relaxed font-normal mb-6">
                We source natural fibres across India—ensuring pure mulberry silks, organic cottons, and non-toxic dyes crafted for enduring wear and cherished family heirloom moments.
              </p>

              <div className="pt-2 flex flex-wrap gap-4">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => onNavigate({ type: 'about' })}
                >
                  Read Our Story
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => onNavigate({ type: 'collection', category: 'sarees' })}
                >
                  Discover Sarees →
                </Button>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </Container>
    </section>
  );
};

