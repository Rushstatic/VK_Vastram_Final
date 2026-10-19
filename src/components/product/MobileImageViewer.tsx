import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { normalizeImageUrl } from '../../lib/imageHelper';
import { ProductVariantImage } from '../../types';
import gsap from 'gsap';

interface MobileImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  images: (string | ProductVariantImage)[];
  initialIndex?: number;
  productName: string;
}

export const MobileImageViewer: React.FC<MobileImageViewerProps> = ({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
  productName,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomScale, setZoomScale] = useState(1);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [activeImageUrl, setActiveImageUrl] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Touch tracking for swiping
  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);

  // Sync initialIndex
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setZoomScale(1);
      setImageLoadError(false);
    }
  }, [isOpen, initialIndex]);

  // Lock body scroll and handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };

    window.addEventListener('keydown', handleKeyDown);

    // GSAP Enter Transition
    if (modalRef.current) {
      gsap.fromTo(
        modalRef.current,
        { opacity: 0, scale: 0.98 },
        { opacity: 1, scale: 1, duration: 0.35, ease: 'power2.out', clearProps: 'transform' }
      );
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const currentItem = images[currentIndex] || images[0];
  const currentUrl = typeof currentItem === 'string' ? currentItem : currentItem?.imageUrl;
  const currentFallbackUrl = typeof currentItem === 'object' ? currentItem?.fallbackImageUrl : undefined;
  const currentRole = currentItem && typeof currentItem === 'object' ? currentItem.role : undefined;
  const normalizedCurrentUrl = normalizeImageUrl(currentUrl);
  const normalizedFallbackUrl = normalizeImageUrl(currentFallbackUrl);

  useLayoutEffect(() => {
    // Reset state and try the primary URL first, falling back to storage_path if needed.
    setActiveImageUrl(normalizedCurrentUrl || normalizedFallbackUrl);
    setImageLoaded(false);
    setImageLoadError(false);
  }, [normalizedCurrentUrl, normalizedFallbackUrl, isOpen]);

  useEffect(() => {
    if (!isOpen || !activeImageUrl || imageLoaded || imageLoadError) return;
    const timeout = window.setTimeout(() => setImageLoadError(true), 12000);
    return () => window.clearTimeout(timeout);
  }, [activeImageUrl, isOpen, imageLoaded, imageLoadError]);

  if (!isOpen || images.length === 0 || typeof document === 'undefined') return null;

  const handleImageLoaded = (event: React.SyntheticEvent<HTMLImageElement>) => {
    setImageLoaded(true);
    setImageLoadError(false);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(event.currentTarget,
      { opacity: 0, scale: 0.94, rotationY: 7, transformPerspective: 900 },
      { opacity: 1, scale: 1, rotationY: 0, duration: 0.65, ease: 'back.out(1.25)', clearProps: 'transform' }
    );
  };

  const handleNext = () => {
    setImageLoadError(false);
    setImageLoaded(false);
    setZoomScale(1);
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrev = () => {
    setImageLoadError(false);
    setImageLoaded(false);
    setZoomScale(1);
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoomScale > 1) return; // Don't swipe while zoomed in
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (zoomScale > 1) return;
    touchEndXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (zoomScale > 1 || touchStartXRef.current === null || touchEndXRef.current === null) return;
    const distance = touchStartXRef.current - touchEndXRef.current;
    const minSwipeDistance = 50;

    if (distance > minSwipeDistance) {
      handleNext();
    } else if (distance < -minSwipeDistance) {
      handlePrev();
    }

    touchStartXRef.current = null;
    touchEndXRef.current = null;
  };

  const handleDoubleTap = () => {
    setZoomScale((prev) => (prev === 1 ? 2.2 : 1));
  };

  const handleClose = () => {
    if (modalRef.current) {
      gsap.to(modalRef.current, {
        opacity: 0,
        scale: 0.98,
        duration: 0.25,
        ease: 'power2.in',
        onComplete: onClose,
      });
    } else {
      onClose();
    }
  };

  // Render on document.body: an ancestor with a CSS transform (the page-enter
  // animation on <main>) would otherwise become the containing block for this
  // fixed overlay and push its header/image far outside the visible screen.
  return createPortal(
    <div
      ref={modalRef}
      className="fixed inset-0 z-[100] bg-[#1C1917]/95 backdrop-blur-md flex flex-col justify-between select-none"
      role="dialog"
      aria-modal="true"
      aria-label={`${productName} fullscreen gallery`}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10 text-white z-20">
        <div className="flex items-center gap-3">
          <span className="font-serif text-sm tracking-wide text-[#FAF8F5]/90 truncate max-w-xs sm:max-w-md">
            {productName}
          </span>
          {currentRole && (
            <span className="inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-2xs bg-[#B88E3E]/20 text-[#B88E3E] border border-[#B88E3E]/30 font-medium">
              {currentRole}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-[#FAF8F5]/70">
            {currentIndex + 1} / {images.length}
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-[#FAF8F5] transition-colors cursor-pointer"
            aria-label="Close fullscreen gallery"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Center Image Stage with Pinch / Swipe */}
      <div
        ref={imageContainerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleTap}
        className="relative flex-1 flex items-center justify-center p-2 sm:p-6 overflow-hidden"
      >
        {activeImageUrl && !imageLoadError && !imageLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[#FAF8F5]/80" role="status" aria-live="polite">
            <span className="h-9 w-9 rounded-full border-2 border-white/20 border-t-[#B88E3E] animate-spin" aria-hidden="true" />
            <span className="font-serif italic text-sm">Unveiling the weave…</span>
          </div>
        )}
        {activeImageUrl && !imageLoadError ? (
          <img
            key={activeImageUrl}
            src={activeImageUrl}
            alt={`${productName} view ${currentIndex + 1}`}
            referrerPolicy="no-referrer"
            onLoad={handleImageLoaded}
            onError={() => {
              if (normalizedFallbackUrl && activeImageUrl !== normalizedFallbackUrl) {
                setActiveImageUrl(normalizedFallbackUrl);
                setImageLoaded(false);
                setImageLoadError(false);
              } else {
                setImageLoaded(false);
                setImageLoadError(true);
              }
            }}
            loading="eager"
            decoding="async"
            className={`max-h-[85vh] max-w-[95vw] object-contain transition-opacity duration-200 cursor-grab active:cursor-grabbing ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            style={{ transform: zoomScale > 1 ? `scale(${zoomScale})` : undefined }}
            draggable={false}
          />
        ) : (
          <div className="max-w-md text-center px-6 py-8 text-[#FAF8F5]" role="status" aria-live="polite">
            <p className="font-serif text-lg">Image unavailable</p>
            <p className="mt-2 text-sm text-white/60">This product image could not be loaded. Check its public image URL in the product gallery and save it again.</p>
          </div>
        )}

        {/* Previous Button (desktop & tablet) */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/40 hover:bg-black/70 text-white border border-white/10 backdrop-blur-xs transition-colors cursor-pointer z-10"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Next Button (desktop & tablet) */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/40 hover:bg-black/70 text-white border border-white/10 backdrop-blur-xs transition-colors cursor-pointer z-10"
            aria-label="Next image"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="px-4 sm:px-6 py-3.5 border-t border-white/10 bg-black/40 flex items-center justify-between text-white text-xs z-20">
        <div className="flex items-center gap-2">
          {/* Zoom In */}
          <button
            type="button"
            onClick={() => setZoomScale((s) => Math.min(3, s + 0.5))}
            className="p-1.5 rounded-xs hover:bg-white/10 text-[#FAF8F5]/80 hover:text-white transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          {/* Zoom Out */}
          <button
            type="button"
            onClick={() => setZoomScale((s) => Math.max(1, s - 0.5))}
            className="p-1.5 rounded-xs hover:bg-white/10 text-[#FAF8F5]/80 hover:text-white transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          {zoomScale > 1 && (
            <button
              type="button"
              onClick={() => setZoomScale(1)}
              className="p-1.5 rounded-xs hover:bg-white/10 text-[#B88E3E] transition-colors cursor-pointer"
              title="Reset Zoom"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <span className="text-[11px] text-white/50 font-mono ml-1">
            {Math.round(zoomScale * 100)}%
          </span>
        </div>

        <div className="text-[11px] text-[#FAF8F5]/60 font-sans hidden sm:block">
          Double-click or pinch to inspect weave · Swipe left/right
        </div>

        {/* Thumbnail Filmstrip */}
        {images.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-[200px] sm:max-w-xs py-1">
            {images.map((item, idx) => {
              const url = typeof item === 'string' ? item : item.imageUrl;
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setImageLoadError(false);
                    setImageLoaded(false);
                    setZoomScale(1);
                    setCurrentIndex(idx);
                  }}
                  className={`w-7 h-9 rounded-2xs overflow-hidden border transition-all shrink-0 cursor-pointer ${
                    currentIndex === idx
                      ? 'border-[#B88E3E] opacity-100'
                      : 'border-white/20 opacity-40 hover:opacity-80'
                  }`}
                >
                  <img
                    src={normalizeImageUrl(url) || undefined}
                    alt={`Thumb ${idx + 1}`}
                    referrerPolicy="no-referrer"
                    onError={(event) => {
                      const entry = images[idx];
                      const fallback = typeof entry === 'string' ? '' : normalizeImageUrl(entry?.fallbackImageUrl);
                      if (fallback && event.currentTarget.dataset.fallbackTried !== 'true') {
                        event.currentTarget.dataset.fallbackTried = 'true';
                        event.currentTarget.src = fallback;
                      }
                    }}
                    loading="lazy" decoding="async" className="w-full h-full object-cover"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
