import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { normalizeImageUrl } from '../../lib/imageHelper';
import { ProductVariantImage } from '../../types';
import gsap from 'gsap';
import { useOverlayBackButton } from '../../lib/overlayHistory';

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
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [activeImageUrl, setActiveImageUrl] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Back button (phone/browser) closes the viewer instead of leaving the product page.
  // X button / Escape go through requestClose() so every way of closing behaves the same.
  const requestClose = useOverlayBackButton(isOpen, onClose);

  // Touch tracking for swiping
  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);
  const panRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const touchEndYRef = useRef<number | null>(null);

  // A different photo always opens at 1x, centred.
  useEffect(() => {
    setZoomScale(1);
    setPan({ x: 0, y: 0 });
  }, [currentIndex]);

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
      if (e.key === 'Escape') requestClose();
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

  // ---- Zoom & pan -------------------------------------------------------
  // Pinch with two fingers, drag with one finger while zoomed, double-tap / double-click to toggle,
  // buttons in the bottom bar. Swiping to change photos is only active when not zoomed.
  const MAX_ZOOM = 4;
  const distanceBetween = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };
  const clampPan = (x: number, y: number, scale: number) => {
    const el = imageContainerRef.current;
    if (!el || scale <= 1) return { x: 0, y: 0 };
    const maxX = (el.clientWidth * (scale - 1)) / 2;
    const maxY = (el.clientHeight * (scale - 1)) / 2;
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  };
  const setZoom = (next: number) => {
    const clamped = Math.max(1, Math.min(MAX_ZOOM, next));
    setZoomScale(clamped);
    setPan((current) => (clamped === 1 ? { x: 0, y: 0 } : clampPan(current.x, current.y, clamped)));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = { distance: distanceBetween(e.touches), scale: zoomScale };
      panRef.current = null;
      touchStartXRef.current = null;
      touchEndXRef.current = null;
      return;
    }
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    if (zoomScale > 1) {
      panRef.current = { x: pan.x, y: pan.y, px: touch.clientX, py: touch.clientY };
      return;
    }
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    touchEndXRef.current = null;
    touchEndYRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const ratio = distanceBetween(e.touches) / Math.max(1, pinchRef.current.distance);
      setZoom(pinchRef.current.scale * ratio);
      return;
    }
    if (e.touches.length === 1 && zoomScale > 1 && panRef.current) {
      const touch = e.touches[0];
      setPan(clampPan(
        panRef.current.x + (touch.clientX - panRef.current.px),
        panRef.current.y + (touch.clientY - panRef.current.py),
        zoomScale
      ));
      return;
    }
    if (zoomScale <= 1 && e.touches.length === 1) {
      touchEndXRef.current = e.touches[0].clientX;
      touchEndYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null;
    if (e.touches.length === 0) panRef.current = null;
    if (zoomScale > 1) return;
    if (touchStartXRef.current === null || touchEndXRef.current === null) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      return;
    }
    const distance = touchStartXRef.current - touchEndXRef.current;
    const verticalDistance = Math.abs((touchStartYRef.current ?? 0) - (touchEndYRef.current ?? 0));
    if (Math.abs(distance) > 40 && Math.abs(distance) > verticalDistance * 1.2) {
      if (distance > 0) handleNext();
      else handlePrev();
    }
    touchStartXRef.current = null;
    touchEndXRef.current = null;
    touchStartYRef.current = null;
    touchEndYRef.current = null;
  };

  const handleDoubleTap = () => {
    if (zoomScale > 1) setZoom(1);
    else setZoom(2.5);
  };

  const handleClose = () => {
    if (modalRef.current) {
      gsap.to(modalRef.current, {
        opacity: 0,
        scale: 0.98,
        duration: 0.25,
        ease: 'power2.in',
        onComplete: requestClose,
      });
    } else {
      requestClose();
    }
  };

  // Render on document.body so no parent element (transform, filter, overflow) can displace
  // this fixed overlay off the visible screen.
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
        className={`relative flex-1 flex items-center justify-center p-2 sm:p-6 overflow-hidden ${zoomScale > 1 ? 'touch-none' : 'touch-pan-y'}`}
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
            style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoomScale})`, transition: 'transform 120ms ease-out' }}
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
            onClick={() => setZoom(zoomScale + 0.5)}
            className="p-1.5 rounded-xs hover:bg-white/10 text-[#FAF8F5]/80 hover:text-white transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          {/* Zoom Out */}
          <button
            type="button"
            onClick={() => setZoom(zoomScale - 0.5)}
            className="p-1.5 rounded-xs hover:bg-white/10 text-[#FAF8F5]/80 hover:text-white transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          {zoomScale > 1 && (
            <button
              type="button"
              onClick={() => setZoom(1)}
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
