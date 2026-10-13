import React, { useState, useEffect } from 'react';
import { normalizeImageUrl } from '../../lib/imageHelper';

export interface ImagePresentationProps {
  fit?: 'cover' | 'contain';
  focalPositionX?: string | number;
  focalPositionY?: string | number;
  scale?: number;
}

interface ImageContainerProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'>, ImagePresentationProps {
  src?: string | null;
  fallbackSrc?: string | null;
  alt: string;
  aspectRatio?: '3/4' | '4/3' | '16/9' | '1/1';
  className?: string;
  imageClassName?: string;
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

export const ImageContainer: React.FC<ImageContainerProps> = ({
  src,
  fallbackSrc,
  alt,
  aspectRatio = '3/4',
  className = '',
  imageClassName = '',
  fit = 'cover',
  focalPositionX,
  focalPositionY,
  scale = 1.0,
  priority = false,
  style,
  ...props
}) => {
  const normalizedSrc = normalizeImageUrl(src);
  const normalizedFallbackSrc = normalizeImageUrl(fallbackSrc);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [activeSrc, setActiveSrc] = useState<string>('');
  const [hasError, setHasError] = useState(false);

  // When source URL changes, immediately invalidate loaded state to eliminate stale image flash
  useEffect(() => {
    setLoadedSrc(null);
    setActiveSrc(normalizedSrc || normalizedFallbackSrc);
    setHasError(false);
  }, [normalizedSrc, normalizedFallbackSrc]);

  const aspectClasses = {
    '3/4': 'aspect-[3/4]',
    '4/3': 'aspect-[4/3]',
    '16/9': 'aspect-[16/9]',
    '1/1': 'aspect-square',
  }[aspectRatio];

  const isLoaded = Boolean(activeSrc && loadedSrc === activeSrc && !hasError);

  return (
    <div
      className={`relative overflow-hidden bg-[#F3EFE6] select-none ${aspectClasses} ${className}`}
    >
      {/* 1. Neutral luxury placeholder background during loading or empty */}
      {(!isLoaded || !normalizedSrc) && !hasError && (
        <div
          aria-hidden="true"
          className="absolute inset-0 overflow-hidden bg-[#EFE9DC]"
        >
          <div className="vk-image-shimmer absolute inset-0" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-[#B88E3E]/[0.06]" />
        </div>
      )}

      {/* 2. Error fallback */}
      {hasError || (!normalizedSrc && !normalizedFallbackSrc) ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-[#F3EFE6] text-[#78716C]">
          <span className="text-xs font-serif italic">{alt || 'Artisanal Textile'}</span>
        </div>
      ) : (
        /* 3. Keyed image ensures clean unmount and eliminates cross-variant buffer flash */
        <img
          key={activeSrc}
          src={activeSrc || normalizedSrc || normalizedFallbackSrc}
          alt={alt}
          referrerPolicy="no-referrer"
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          onLoad={() => setLoadedSrc(activeSrc || normalizedSrc)}
          onError={() => {
            if (normalizedFallbackSrc && normalizedFallbackSrc !== activeSrc) {
              setLoadedSrc(null);
              setActiveSrc(normalizedFallbackSrc);
              setHasError(false);
            } else {
              setHasError(true);
            }
          }}
          className={`w-full h-full transition-[opacity,filter,transform] duration-500 ease-out ${
            isLoaded ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-sm scale-[1.015] pointer-events-none'
          } ${imageClassName}`}
          style={{
            objectFit: fit,
            objectPosition: `${parseFocalPercent(focalPositionX)} ${parseFocalPercent(focalPositionY)}`,
            transform: scale && scale !== 1.0 ? `scale(${scale})` : undefined,
            ...style,
          }}
          {...props}
        />
      )}
    </div>
  );
};

