import React from 'react';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import DefaultLogo from '../../assets/images/vk_emblem_small_1791213158854.jpg';

export interface VKVastramLogoProps {
  variant?: 'full' | 'emblem' | 'wordmark';
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
  className?: string;
  onClick?: () => void;
}

export const VKVastramLogo: React.FC<VKVastramLogoProps> = ({
  variant = 'full',
  size = 'md',
  animate = true,
  className = '',
  onClick,
}) => {
  const { settings } = useSiteSettings();
  const storeName = settings?.storeName || 'VK VASTRAM';
  const logoSrc = settings?.logoUrl || DefaultLogo;

  // Size mapping for emblem container & image
  const sizeMap = {
    sm: {
      wrapper: 'w-7 h-7',
      img: 'w-5.5 h-5.5',
      text: 'text-lg sm:text-xl tracking-[0.25em]',
    },
    md: {
      wrapper: 'w-10 h-10',
      img: 'w-8 h-8',
      text: 'text-2xl sm:text-3xl tracking-[0.35em]',
    },
    lg: {
      wrapper: 'w-14 h-14',
      img: 'w-11 h-11',
      text: 'text-3xl sm:text-4xl tracking-[0.4em]',
    },
  }[size];

  const emblem = (
    <div className={`relative ${sizeMap.wrapper} flex items-center justify-center shrink-0`}>
      {/* Subtle slow rotating maroon ring (restrained, no pulsing or blinking) */}
      {animate && (
        <div className="absolute inset-0 border border-[#78281F]/30 rounded-full animate-spin-slow pointer-events-none" />
      )}
      <img
        src={logoSrc}
        alt={storeName}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = DefaultLogo;
        }}
        className={`${sizeMap.img} rounded-full object-cover shadow-2xs`}
      />
    </div>
  );

  const wordmark = (
    <span
      className={`font-serif font-semibold text-[#78281F] uppercase transition-colors group-hover:text-[#967029] select-none ${sizeMap.text}`}
    >
      {storeName}
    </span>
  );

  if (variant === 'emblem') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center justify-center ${onClick ? 'cursor-pointer' : ''} ${className}`}
      >
        {emblem}
      </div>
    );
  }

  if (variant === 'wordmark') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center ${onClick ? 'cursor-pointer' : ''} ${className}`}
      >
        {wordmark}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-3.5 group ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {emblem}
      {wordmark}
    </div>
  );
};
