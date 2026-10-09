import React, { useState, useRef, useCallback, useEffect } from 'react';
import { normalizeImageUrl } from '../../lib/imageHelper';
import { Sparkles, ZoomIn } from 'lucide-react';

interface ProductImageMagnifierProps {
  src: string;
  alt: string;
  zoomLevel?: number; // e.g. 2.2x to 2.8x
  aspectRatio?: '3/4' | '1/1' | '4/5';
  roleTag?: string;
  onOpenFullscreen?: () => void;
  className?: string;
  fit?: 'cover' | 'contain';
  focalPositionX?: string | number;
  focalPositionY?: string | number;
  scale?: number;
  priority?: boolean;
}

function parseFocalPercent(val?: string | number): string {
  if (val === undefined || val === null || val === '') return '50%';
  if (typeof val === 'number') return `${Math.max(0, Math.min(100, val))}%`;
  const s = String(val).trim().toLowerCase();
  if (s === 'left' || s === 'top') return '0%';
  if (s === 'left-center' || s === 'upper' || s === '25%') return '25%';
  if (s === 'right-center' || s === 'lower' || s === '75%') return '75%';
  if (s === 'right' || s === 'bottom') return '100%';
  if (s.endsWith('%')) return s;
  const n = parseFloat(s);
  if (!isNaN(n)) return `${Math.max(0, Math.min(100, n))}%`;
  return '50%';
}

export const ProductImageMagnifier: React.FC<ProductImageMagnifierProps> = ({
  src,
  alt,
  zoomLevel = 2.4,
  aspectRatio = '3/4',
  roleTag,
  onOpenFullscreen,
  className = '',
  fit = 'cover',
  focalPositionX,
  focalPositionY,
  scale = 1.0,
  priority = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 50, y: 50 }); // percentages
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const normalizedSrc = normalizeImageUrl(src);

  // Immediately reset load status when image src changes — eliminates cross-variant buffer flash
  useEffect(() => {
    setLoadedSrc(null);
    setHasError(false);
  }, [normalizedSrc]);

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || prefersReducedMotion) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setCursorPos({ x, y });
  }, [prefersReducedMotion]);

  const handleMouseEnter = () => {
    if (!prefersReducedMotion) {
      setIsHovering(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  const aspectClass = {
    '3/4': 'aspect-[3/4]',
    '1/1': 'aspect-square',
    '4/5': 'aspect-[4/5]',
  }[aspectRatio];

  const isLoaded = Boolean(normalizedSrc && loadedSrc === normalizedSrc && !hasError);

  const focalXCss = parseFocalPercent(focalPositionX);
  const focalYCss = parseFocalPercent(focalPositionY);

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      onClick={onOpenFullscreen}
      className={`relative w-full ${aspectClass} overflow-hidden rounded-xs bg-[#F4EFE6] select-none cursor-crosshair group ${className}`}
      aria-label={`${alt} — Hover to magnify weave detail, click for fullscreen`}
    >
      {/* 1. Neutral luxury skeleton while image is downloading */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-[#EFE8DA] flex items-center justify-center animate-pulse z-0">
          <span className="font-serif italic text-xs text-[#78716C]">Loading artisanal drape...</span>
        </div>
      )}

      {/* 2. Error Fallback */}
      {hasError && (
        <div className="absolute inset-0 bg-[#F4EFE6] flex items-center justify-center p-4 text-center z-0">
          <span className="font-serif italic text-xs text-[#78716C]">{alt}</span>
        </div>
      )}

      {/* 3. Base High Quality Image (Keyed to clear previous buffer immediately) */}
      {normalizedSrc && !hasError && (
        <img
          key={normalizedSrc}
          src={normalizedSrc}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          onLoad={() => setLoadedSrc(normalizedSrc)}
          onError={() => setHasError(true)}
          className={`w-full h-full transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${isHovering ? 'opacity-0' : 'opacity-100'}`}
          style={{
            objectFit: fit,
            objectPosition: `${focalXCss} ${focalYCss}`,
            transform: scale && scale !== 1.0 ? `scale(${scale})` : undefined,
          }}
        />
      )}

      {/* 4. Magnified View Layer */}
      {isLoaded && isHovering && !prefersReducedMotion && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-200"
          style={{
            backgroundImage: `url("${normalizedSrc}")`,
            backgroundPosition: `${cursorPos.x}% ${cursorPos.y}%`,
            backgroundSize: `${zoomLevel * 100}%`,
            backgroundRepeat: 'no-repeat',
          }}
        />
      )}

      {/* 5. Subtle Inspection Lens Guide (editorial watermark) */}
      {isLoaded && isHovering && !prefersReducedMotion && (
        <div
          className="absolute bottom-3 right-3 pointer-events-none z-20 flex items-center gap-1.5 px-2.5 py-1 bg-[#1C1917]/80 backdrop-blur-xs text-[#FAF8F5] text-[10px] uppercase tracking-wider font-medium rounded-xs border border-white/10"
        >
          <Sparkles className="w-3 h-3 text-[#B88E3E]" />
          <span>{Math.round(zoomLevel * 100)}% Textile Detail</span>
        </div>
      )}

      {/* 6. Click to Inspect / Mobile Hint */}
      {isLoaded && !isHovering && (
        <div className="absolute bottom-3 right-3 z-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenFullscreen?.();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FAF8F5]/90 hover:bg-[#FAF8F5] backdrop-blur-xs text-[#1C1917] text-xs font-medium rounded-xs border border-[#1C1917]/15 shadow-2xs transition-colors cursor-pointer"
            title="Expand Fullscreen Gallery"
          >
            <ZoomIn className="w-3.5 h-3.5 text-[#967029]" />
            <span className="text-[11px] font-sans">Inspect Fullscreen</span>
          </button>
        </div>
      )}

      {/* 7. Semantic Image Role Tag */}
      {roleTag && isLoaded && (
        <div className="absolute top-3 right-3 z-10 pointer-events-none">
          <span className="inline-block bg-[#FAF8F5]/90 backdrop-blur-xs text-[#1C1917] border border-[#1C1917]/10 text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-2xs shadow-2xs">
            {roleTag}
          </span>
        </div>
      )}
    </div>
  );
};
