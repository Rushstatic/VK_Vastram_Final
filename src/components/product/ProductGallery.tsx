import React, { useState, useEffect, useRef } from 'react';
import { normalizeImageUrl } from '../../lib/imageHelper';
import { ProductVariantImage } from '../../types';
import { ProductImageMagnifier } from './ProductImageMagnifier';
import { MobileImageViewer } from './MobileImageViewer';
import gsap from 'gsap';

interface ProductGalleryProps {
  images: (string | ProductVariantImage)[];
  productName: string;
  isSoldOut?: boolean;
  onSale?: boolean;
  tag?: string;
  variantKey?: string; // Changes when user selects a different color/variant
}

export const ProductGallery: React.FC<ProductGalleryProps> = ({
  images,
  productName,
  isSoldOut = false,
  onSale = false,
  tag,
  variantKey,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const mainStageRef = useRef<HTMLDivElement>(null);
  const thumbnailRailRef = useRef<HTMLDivElement>(null);
  const prevVariantRef = useRef<string | undefined>(variantKey);
  // Swipe support for the main image (touch devices)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipedRef = useRef(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check prefers-reduced-motion per Section 32
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, []);

  // Normalize images list
  const normalizedImages: ProductVariantImage[] = React.useMemo(() => {
    if (!images || images.length === 0) return [];
    return images
      .map((item, idx): ProductVariantImage => {
        if (typeof item === 'string') {
          return {
            imageUrl: item,
            role: idx === 0 ? 'hero' : 'gallery',
            sortOrder: idx + 1,
          };
        }
        return item;
      })
      // Empty image URLs must not create a phantom 1/1 fullscreen slide.
      .filter((item) => typeof item.imageUrl === 'string' && item.imageUrl.trim().length > 0);
  }, [images]);

  // When variant changes (e.g., user selects Lavender -> Gold), smoothly reset activeIndex to 0 with GSAP crossfade
  useEffect(() => {
    if (variantKey !== prevVariantRef.current) {
      prevVariantRef.current = variantKey;
      setActiveIndex(0);

      if (prefersReducedMotion || !mainStageRef.current) return;

      // GSAP Variant Switch Animation per Prompt 26 Section 12 with context cleanup
      const ctx = gsap.context(() => {
        gsap.fromTo(
          mainStageRef.current,
          { opacity: 0, scale: 1.01 },
          { opacity: 1, scale: 1, duration: 0.45, ease: 'power2.out' }
        );
      }, mainStageRef);

      return () => ctx.revert();
    }
  }, [variantKey, prefersReducedMotion]);

  // Stable signature of the gallery: the parent rebuilds the images array whenever the product
  // object refreshes, which used to hide and re-animate the thumbnails over and over.
  const imagesKey = React.useMemo(() => normalizedImages.map((image) => image.imageUrl).join('|'), [normalizedImages]);

  // Secondary image cards enter shortly after the main image with a restrained grow/turn reveal.
  // Hide them at effect setup (not at animation start) to avoid a visible jump.
  // Reduced-motion users see them immediately; GSAP contexts are reverted on changes/unmount.
  useEffect(() => {
    const rail = thumbnailRailRef.current;
    if (!rail) return;
    const thumbs = rail.querySelectorAll<HTMLElement>('[data-gallery-thumb]');
    if (prefersReducedMotion || thumbs.length === 0) {
      gsap.set(thumbs, { clearProps: 'all' });
      return;
    }
    const context = gsap.context(() => {
      gsap.set(thumbs, { autoAlpha: 0, scale: 0.88, rotationY: 10, transformPerspective: 800 });
      gsap.to(thumbs, {
        autoAlpha: 1,
        scale: 1,
        rotationY: 0,
        delay: 0.25,
        duration: 0.45,
        stagger: 0.08,
        ease: 'power2.out',
        clearProps: 'transform',
      });
    }, rail);
    return () => context.revert();
  }, [imagesKey, prefersReducedMotion]);

  // Handle thumbnail click with subtle GSAP transition
  const handleThumbnailSelect = (index: number) => {
    if (index === activeIndex) return;
    setActiveIndex(index);

    if (prefersReducedMotion || !mainStageRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        mainStageRef.current,
        { opacity: 0.7, scale: 0.995 },
        { opacity: 1, scale: 1, duration: 0.35, ease: 'power1.out' }
      );
    }, mainStageRef);

    return () => ctx.revert();
  };

  // Move to the next / previous image (wraps around). Used by swipe gestures.
  const goToRelative = (delta: number) => {
    const total = normalizedImages.length;
    if (total < 2) return;
    handleThumbnailSelect((activeIndex + delta + total) % total);
  };

  const handleStageTouchStart = (event: React.TouchEvent) => {
    if (event.touches.length !== 1) { touchStartRef.current = null; return; }
    touchStartRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  };

  const handleStageTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || normalizedImages.length < 2) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    // A deliberate, mostly-horizontal swipe changes the image; vertical drags still scroll the page.
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      swipedRef.current = true;
      window.setTimeout(() => { swipedRef.current = false; }, 400);
      goToRelative(dx < 0 ? 1 : -1);
    }
  };

  const activeImage = normalizedImages[activeIndex] || normalizedImages[0] || { imageUrl: '' };

  const getRoleDisplayName = (role?: string) => {
    switch (role) {
      case 'hero':
        return 'Hero Drape';
      case 'full_saree':
        return 'Full Saree View';
      case 'pallu':
        return 'Pallu End-piece';
      case 'border':
        return 'Zari Border';
      case 'texture':
        return 'Weave Texture';
      case 'detail':
        return 'Artisanal Detail';
      case 'lifestyle':
        return 'Draped Silhouette';
      case 'model':
        return 'Model View';
      case 'thumbnail':
        return 'Catalog View';
      default:
        return undefined;
    }
  };

  if (normalizedImages.length === 0) {
    return (
      <div className="w-full aspect-[3/4] bg-[#F4EFE6] rounded-xs border border-[#1C1917]/10 flex items-center justify-center">
        <span className="font-serif italic text-sm text-[#78716C]">Artisanal drape preview coming soon</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col-reverse md:flex-row gap-4 w-full">
      {/* 1. Left Vertical Thumbnail Rail (Desktop) / Horizontal Rail (Mobile) */}
      {normalizedImages.length > 1 && (
        <div ref={thumbnailRailRef} className="flex md:flex-col gap-2.5 overflow-x-auto md:overflow-y-auto shrink-0 md:w-20 md:max-h-[640px] py-1 select-none">
          {normalizedImages.map((img, idx) => {
            const isSelected = activeIndex === idx;
            return (
              <button
                key={`${img.imageUrl}-${idx}`}
                type="button"
                onClick={() => handleThumbnailSelect(idx)}
                aria-label={`View ${productName} image ${idx + 1}`}
                data-gallery-thumb="true" className={`group relative w-16 h-20 md:w-20 md:h-26 rounded-xs overflow-hidden border-2 transition-all duration-200 cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B88E3E] ${
                  isSelected
                    ? 'border-[#B88E3E] shadow-2xs opacity-100 scale-[1.02]'
                    : 'border-transparent opacity-60 hover:opacity-90'
                }`}
              >
                <img
                  src={normalizeImageUrl(img.imageUrl)}
                  alt={`${productName} thumbnail ${idx + 1}`}
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    const fallback = normalizeImageUrl(img.fallbackImageUrl);
                    if (fallback && event.currentTarget.dataset.fallbackTried !== 'true') {
                      event.currentTarget.dataset.fallbackTried = 'true';
                      event.currentTarget.src = fallback;
                    }
                  }}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                {img.role && (
                  <span className="absolute bottom-0 inset-x-0 bg-[#1C1917]/80 text-[#FAF8F5] text-[8px] font-sans uppercase tracking-wider text-center py-0.5 truncate px-0.5">
                    {img.role === 'full_saree' ? 'full saree' : img.role}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 2. Main Large Image Stage with Desktop Magnifier */}
      <div className="flex-1 relative">
        <div
          ref={mainStageRef}
          className="w-full touch-pan-y"
          onTouchStart={handleStageTouchStart}
          onTouchEnd={handleStageTouchEnd}
          onClickCapture={(event) => {
            // A swipe must not also count as a tap that opens the fullscreen viewer.
            if (swipedRef.current) {
              event.preventDefault();
              event.stopPropagation();
              swipedRef.current = false;
            }
          }}
        >
          <ProductImageMagnifier
            key={activeImage.imageUrl}
            src={activeImage.imageUrl}
            fallbackSrc={activeImage.fallbackImageUrl}
            alt={`${productName} — ${activeImage.role || 'Main View'}`}
            roleTag={getRoleDisplayName(activeImage.role)}
            onOpenFullscreen={() => setIsFullscreenOpen(true)}
            aspectRatio="3/4"
            fit={activeImage.fit}
            focalPositionX={activeImage.focalPositionX}
            focalPositionY={activeImage.focalPositionY}
            scale={activeImage.scale}
            priority={activeIndex === 0}
            className="border border-[#1C1917]/10 shadow-xs"
          />
        </div>

        {/* Status Badges Overlay */}
        {isSoldOut ? (
          <span className="absolute top-4 left-4 z-20 bg-[#1C1917]/95 text-[#FAF8F5] text-[10px] uppercase tracking-wider font-semibold px-3 py-1 border border-white/20 shadow-xs">
            Sold Out
          </span>
        ) : onSale ? (
          <span className="absolute top-4 left-4 z-20 bg-[#78281F] text-[#FAF8F5] text-[10px] uppercase tracking-wider font-medium px-2.5 py-1 shadow-xs">
            Festive Selection
          </span>
        ) : tag ? (
          <span className="absolute top-4 left-4 z-20 bg-[#FAF8F5]/90 backdrop-blur-xs text-[#1C1917] border border-[#1C1917]/10 text-[10px] uppercase tracking-wider font-medium px-2.5 py-1 shadow-2xs">
            {tag}
          </span>
        ) : null}

        {/* Mobile: position dots + hint that the image can be swiped */}
        {normalizedImages.length > 1 && (
          <div className="absolute bottom-3 inset-x-0 z-20 flex justify-center items-center gap-1.5 md:hidden pointer-events-none" aria-hidden="true">
            {normalizedImages.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-200 ${idx === activeIndex ? 'w-4 bg-[#B88E3E]' : 'w-1.5 bg-[#FAF8F5]/80 shadow-xs'}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* 3. Fullscreen / Mobile Pinch-to-Zoom Viewer */}
      <MobileImageViewer
        isOpen={isFullscreenOpen}
        onClose={() => setIsFullscreenOpen(false)}
        images={normalizedImages}
        initialIndex={activeIndex}
        productName={productName}
      />
    </div>
  );
};
