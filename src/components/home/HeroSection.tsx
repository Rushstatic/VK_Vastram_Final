import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Container } from '../ui/Container';
import { Button } from '../ui/Button';
import { HERO_IMAGE } from '../../data/catalog';
import { PageView } from '../../types';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { adminService, HomepageSectionData, HeroSlide } from '../../services/adminService';
import { normalizeImageUrl } from '../../lib/imageHelper';
import { gsap } from '../../lib/gsap';

interface HeroSectionProps {
  onNavigate: (page: PageView) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onNavigate }) => {
  const { settings } = useSiteSettings();
  const storeName = settings?.storeName || 'VK VASTRAM';

  // Synchronously initialize heroData from cached sections if available
  const initialCachedHero = React.useMemo(() => {
    const cached = adminService.getCachedHomepageSections();
    if (cached) {
      const found = cached.find((s) => s.sectionType === 'hero');
      if (found) return found;
    }
    return null;
  }, []);

  const [heroData, setHeroData] = useState<HomepageSectionData | null>(initialCachedHero);
  const [isLoading, setIsLoading] = useState<boolean>(!initialCachedHero);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [animateEntrance, setAnimateEntrance] = useState(false);

  const touchStartXRef = useRef<number | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const narrativeRef = useRef<HTMLDivElement | null>(null);

  // GSAP slide transition animation for editorial narrative
  useEffect(() => {
    if (prefersReducedMotion) return;
    const el = narrativeRef.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const items = el.querySelectorAll('.gsap-hero-anim');
      if (items.length > 0) {
        gsap.fromTo(
          items,
          { autoAlpha: 0, y: 14 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.75,
            stagger: 0.08,
            ease: 'power3.out',
            clearProps: 'transform',
          }
        );
      }
    }, narrativeRef);

    return () => {
      ctx.revert();
    };
  }, [currentSlideIndex, prefersReducedMotion]);

  // Trigger entrance sequence shortly after mounting
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimateEntrance(true);
    }, 120);
    return () => clearTimeout(timer);
  }, []);

  // 1. Check and subscribe to prefers-reduced-motion media query
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

  // 2. Fetch homepage sections from CMS
  const loadHeroSection = useCallback(async () => {
    try {
      const sections = await adminService.getHomepageSections();
      const hero = sections.find((s) => s.sectionType === 'hero');
      if (hero) {
        setHeroData(hero);
      }
    } catch {
      // Fall back gracefully after loading completes
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHeroSection();

    const handleUpdate = () => {
      loadHeroSection();
    };

    window.addEventListener('vk_homepage_updated', handleUpdate);
    return () => {
      window.removeEventListener('vk_homepage_updated', handleUpdate);
    };
  }, [loadHeroSection]);

  // 3. Derive active slides array with backward compatibility
  const slides: HeroSlide[] = React.useMemo(() => {
    if (!heroData) {
      return [
        {
          id: 'default-hero-1',
          desktopImage: HERO_IMAGE,
          mobileImage: undefined,
          eyebrow: 'The Heritage Loom',
          heading: 'Timeless Indian Textiles for Modern Living.',
          description:
            'Authentic handwoven sarees, pure katan silks, and breathable organic cotton bedsheets—crafted with generational patience and pure materials.',
          primaryCtaText: 'Explore Sarees',
          primaryCtaUrl: '/sarees',
          secondaryCtaText: 'Shop Bedsheets',
          secondaryCtaUrl: '/bedsheets',
          badge: 'Crimson & Temple Zari Bridal Kanjivaram',
          sortOrder: 1,
          isActive: true,
        },
      ];
    }

    const rawSlides: HeroSlide[] = Array.isArray(heroData.content?.slides)
      ? heroData.content.slides
      : [];

    const activeSlides = rawSlides
      .filter((s) => s.isActive !== false)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    if (activeSlides.length > 0) {
      return activeSlides;
    }

    // Backward compatibility: synthesize Slide 1 from root section properties
    return [
      {
        id: 'legacy-hero-1',
        desktopImage: heroData.imageUrl || HERO_IMAGE,
        mobileImage: heroData.mobileImageUrl || undefined,
        eyebrow: 'The Heritage Loom',
        heading: heroData.title || 'Timeless Indian Textiles for Modern Living.',
        description:
          heroData.subtitle ||
          'Authentic handwoven sarees, pure katan silks, and breathable organic cotton bedsheets—crafted with generational patience and pure materials.',
        primaryCtaText: heroData.buttonText || 'Explore Sarees',
        primaryCtaUrl: heroData.buttonUrl || '/sarees',
        secondaryCtaText: 'Shop Bedsheets',
        secondaryCtaUrl: '/bedsheets',
        badge: heroData.content?.badge || 'Crimson & Temple Zari Bridal Kanjivaram',
        sortOrder: 1,
        isActive: true,
      },
    ];
  }, [heroData]);

  // Ensure currentSlideIndex stays within valid bounds
  useEffect(() => {
    if (currentSlideIndex >= slides.length) {
      setCurrentSlideIndex(0);
    }
  }, [slides.length, currentSlideIndex]);

  // 4. Preload next slide images to eliminate any transition flicker
  useEffect(() => {
    if (slides.length <= 1) return;

    const nextIndex = (currentSlideIndex + 1) % slides.length;
    const nextSlide = slides[nextIndex];
    if (nextSlide) {
      const desktopUrl = normalizeImageUrl(nextSlide.desktopImage || HERO_IMAGE);
      if (desktopUrl) {
        const img = new Image();
        img.src = desktopUrl;
      }
      if (nextSlide.mobileImage) {
        const mobileUrl = normalizeImageUrl(nextSlide.mobileImage);
        if (mobileUrl) {
          const mobileImg = new Image();
          mobileImg.src = mobileUrl;
        }
      }
    }
  }, [currentSlideIndex, slides]);

  // 5. Automatic crossfade timer logic (5.5s interval)
  // Pauses strictly when:
  // - There is only 1 slide
  // - prefers-reduced-motion is active
  // - Cursor is hovering over the carousel (isHovered)
  // - Focus is within any element of the carousel (isFocused)
  useEffect(() => {
    if (slides.length <= 1 || isHovered || isFocused || prefersReducedMotion) {
      return;
    }

    const timer = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
    }, 5500);

    return () => clearInterval(timer);
  }, [slides.length, isHovered, isFocused, prefersReducedMotion]);

  if (heroData && heroData.isActive === false) {
    return null;
  }

  // Show a neutral editorial skeleton loader on initial cold visit if uncached
  if (isLoading && !heroData) {
    return (
      <section className="relative bg-[#FAF8F5] pt-6 pb-16 sm:pb-24 border-b border-[#1C1917]/10">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-5 flex flex-col justify-center order-2 lg:order-1 pt-4 lg:pt-0 space-y-4">
              <div className="w-28 h-3 bg-[#EFE9DC] rounded-xs animate-pulse" />
              <div className="w-full h-10 bg-[#EFE9DC] rounded-xs animate-pulse" />
              <div className="w-3/4 h-10 bg-[#EFE9DC] rounded-xs animate-pulse" />
              <div className="w-5/6 h-12 bg-[#EFE9DC] rounded-xs animate-pulse" />
              <div className="flex gap-4 pt-4">
                <div className="w-36 h-10 bg-[#EFE9DC] rounded-xs animate-pulse" />
                <div className="w-36 h-10 bg-[#EFE9DC] rounded-xs animate-pulse" />
              </div>
            </div>
            <div className="lg:col-span-7 order-1 lg:order-2">
              <div className="relative rounded-xs overflow-hidden bg-[#F4EFE6] border border-[#1C1917]/10 aspect-[4/3] sm:aspect-[16/10] flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-[#B88E3E]/30 border-t-[#B88E3E] animate-spin" />
              </div>
            </div>
          </div>
        </Container>
      </section>
    );
  }

  const currentSlide = slides[currentSlideIndex] || slides[0];

  const handleNavigateCta = (url: string) => {
    if (!url) {
      onNavigate({ type: 'collection', category: 'sarees' });
      return;
    }
    if (url.startsWith('/bedsheets')) {
      onNavigate({ type: 'collection', category: 'bedsheets' });
    } else if (url.startsWith('/home-textiles')) {
      onNavigate({ type: 'collection', category: 'home-textiles' });
    } else if (url.startsWith('/sale')) {
      onNavigate({ type: 'sale' });
    } else if (url.startsWith('/about')) {
      onNavigate({ type: 'about' });
    } else if (url.startsWith('/faq')) {
      onNavigate({ type: 'faq' });
    } else if (url.startsWith('/contact')) {
      onNavigate({ type: 'contact' });
    } else {
      onNavigate({ type: 'collection', category: 'sarees' });
    }
  };

  const handlePrevSlide = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrentSlideIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleNextSlide = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
  };

  // Keyboard navigation when carousel is focused
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (slides.length <= 1) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handlePrevSlide();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleNextSlide();
    }
  };

  // Touch swipe support on mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || slides.length <= 1) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - touchEndX;

    // Minimum swipe threshold (50px)
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        handleNextSlide();
      } else {
        handlePrevSlide();
      }
    }
    touchStartXRef.current = null;
  };

  const saleBadgeEnabled = Boolean(heroData?.content?.sale_badge_enabled);
  const saleBadgeText = heroData?.content?.sale_badge_text || 'SALE IS LIVE';

  return (
    <section
      ref={sectionRef}
      aria-roledescription="carousel"
      aria-label="Homepage Hero Showcase"
      className="relative bg-[#FAF8F5] pt-6 pb-16 sm:pb-24 border-b border-[#1C1917]/10 outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={(e) => {
        // Only mark unfocused if focus moved outside of the section container
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsFocused(false);
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Editorial Narrative */}
          <div className="lg:col-span-5 flex flex-col justify-center order-2 lg:order-1 pt-4 lg:pt-0">
            <div
              key={currentSlide.id || currentSlideIndex}
              ref={narrativeRef}
              className="animate-hero-text"
            >
              <div className="gsap-hero-anim inline-flex items-center gap-2 mb-4">
                <span className="w-6 h-[1px] bg-[#B88E3E]" />
                <span className="text-[11px] uppercase tracking-[0.25em] text-[#967029] font-medium">
                  {currentSlide.eyebrow || 'The Heritage Loom'}
                </span>
              </div>

              <h1 className="gsap-hero-anim font-serif text-3xl sm:text-4xl lg:text-5xl font-normal text-[#1C1917] tracking-tight leading-[1.15] text-balance">
                {currentSlide.heading}
              </h1>

              <p className="gsap-hero-anim mt-4 sm:mt-5 text-sm sm:text-base text-[#57534E] leading-relaxed max-w-lg font-normal text-balance">
                {currentSlide.description}
              </p>

              <div className="gsap-hero-anim mt-8 flex flex-wrap items-center gap-4">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleNavigateCta(currentSlide.primaryCtaUrl)}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {currentSlide.primaryCtaText || 'Explore Sarees'}
                </Button>

                {currentSlide.secondaryCtaText && (
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => handleNavigateCta(currentSlide.secondaryCtaUrl || '/bedsheets')}
                  >
                    {currentSlide.secondaryCtaText}
                  </Button>
                )}
              </div>
            </div>

            {/* Subtle Editorial Assurance */}
            <div className={`mt-10 pt-6 border-t border-[#1C1917]/10 flex items-center gap-6 text-xs text-[#78716C] transition-all duration-700 delay-[400ms] ease-out ${prefersReducedMotion ? '' : animateEntrance ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div>
                <span className="font-serif text-base text-[#1C1917] block">100%</span>
                <span>Pure Silk & Cotton</span>
              </div>
              <div className="w-[1px] h-8 bg-[#1C1917]/10" />
              <div>
                <span className="font-serif text-base text-[#1C1917] block">Regional</span>
                <span>Weaving Clusters</span>
              </div>
              <div className="w-[1px] h-8 bg-[#1C1917]/10" />
              <div>
                <span className="font-serif text-base text-[#1C1917] block">Direct</span>
                <span>From Master Artisans</span>
              </div>
            </div>
          </div>

          {/* Right Hero Visual Stage with Multi-Slide Crossfade */}
          <div className="lg:col-span-7 order-1 lg:order-2">
            <div className="relative rounded-xs overflow-hidden bg-[#F4EFE6] border border-[#1C1917]/10 shadow-xs group">
              {/* Editorial SALE Tag */}
              {saleBadgeEnabled && (
                <div
                  className="absolute top-3.5 left-3.5 sm:top-5 sm:left-5 z-20 flex items-center gap-1.5 px-3 py-1 bg-[#78281F] border border-[#B88E3E]/40 shadow-xs text-[#FAF8F5] rounded-xs select-none"
                  aria-live="polite"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B88E3E]" />
                  <span className="text-[10px] uppercase tracking-[0.2em] font-medium">
                    {saleBadgeText}
                  </span>
                </div>
              )}

              {/* Aspect Ratio Container */}
              <div className="relative w-full aspect-[4/3] sm:aspect-[16/10]">
                {slides.map((slide, index) => {
                  const isActive = index === currentSlideIndex;
                  const desktopSrc = normalizeImageUrl(slide.desktopImage || HERO_IMAGE);
                  const mobileSrc = normalizeImageUrl(slide.mobileImage || slide.desktopImage || HERO_IMAGE);

                  return (
                    <div
                      key={slide.id || index}
                      aria-hidden={!isActive}
                      className={`absolute inset-0 transition-opacity duration-700 ease-in-out motion-reduce:transition-none ${
                        isActive ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'
                      }`}
                    >
                      <picture>
                        {slide.mobileImage && (
                          <source media="(max-width: 640px)" srcSet={mobileSrc} />
                        )}
                        <img
                          src={desktopSrc}
                          alt={slide.heading || `${storeName} Handcrafted Heritage Saree`}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = HERO_IMAGE;
                          }}
                          className={`w-full h-full transition-all ease-out ${prefersReducedMotion ? '' : animateEntrance ? 'duration-1200 scale-100 opacity-100' : 'duration-300 scale-103 opacity-30'}`}
                          style={{
                            objectFit: slide.fit || 'cover',
                            objectPosition: `${slide.focalPositionX || 'center'} ${slide.focalPositionY || 'center'}`
                          }}
                        />
                      </picture>

                      <div className="absolute inset-0 bg-gradient-to-t from-[#1C1917]/50 via-transparent to-transparent" />
                    </div>
                  );
                })}

                {/* Signature Weave / Badge Overlay */}
                <div className="absolute bottom-4 left-4 right-16 sm:bottom-6 sm:left-6 z-20 text-[#FAF8F5]">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#E5D7B7] font-medium">
                    Signature Weave
                  </p>
                  <p className="font-serif text-base sm:text-lg text-white font-normal mt-0.5 drop-shadow-xs">
                    {currentSlide.badge || 'Artisanal Handloom Masterpiece'}
                  </p>
                </div>

                {/* Minimal Manual Navigation Arrows (Only when 2+ slides exist) */}
                {slides.length > 1 && (
                  <div className="absolute top-1/2 -translate-y-1/2 inset-x-2 z-20 flex items-center justify-between pointer-events-none">
                    <button
                      type="button"
                      onClick={handlePrevSlide}
                      aria-label="Previous slide"
                      className="pointer-events-auto w-8 h-8 rounded-full bg-[#1C1917]/40 hover:bg-[#1C1917]/80 text-[#FAF8F5] flex items-center justify-center backdrop-blur-xs transition-all opacity-0 group-hover:opacity-100 cursor-pointer border border-white/10 focus-visible:opacity-100 outline-none"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextSlide}
                      aria-label="Next slide"
                      className="pointer-events-auto w-8 h-8 rounded-full bg-[#1C1917]/40 hover:bg-[#1C1917]/80 text-[#FAF8F5] flex items-center justify-center backdrop-blur-xs transition-all opacity-0 group-hover:opacity-100 cursor-pointer border border-white/10 focus-visible:opacity-100 outline-none"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Understated Pagination Dots (Only when 2+ slides exist) */}
                {slides.length > 1 && (
                  <div
                    className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-20 flex items-center gap-1.5"
                    role="tablist"
                    aria-label="Hero carousel pagination"
                  >
                    {slides.map((_, dotIdx) => {
                      const isActive = dotIdx === currentSlideIndex;
                      return (
                        <button
                          key={dotIdx}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          aria-label={`Go to slide ${dotIdx + 1}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentSlideIndex(dotIdx);
                          }}
                          className={`h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none cursor-pointer ${
                            isActive
                              ? 'w-6 bg-[#FAF8F5] shadow-xs'
                              : 'w-1.5 bg-[#FAF8F5]/40 hover:bg-[#FAF8F5]/75'
                          }`}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
};
