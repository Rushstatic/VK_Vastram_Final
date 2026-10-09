import React from 'react';
import { resolveCanonicalColor, getSwatchBackground, CanonicalColor } from '../../lib/colorSystem';

interface ColorSwatchProps {
  colorName: string;
  hexPrimary?: string;
  hexSecondary?: string;
  swatchImageUrl?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const ColorSwatch: React.FC<ColorSwatchProps> = ({
  colorName,
  hexPrimary,
  hexSecondary,
  swatchImageUrl,
  selected = false,
  disabled = false,
  onClick,
  size = 'md',
  showLabel = false,
  className = '',
}) => {
  const canonical: CanonicalColor = React.useMemo(() => {
    const base = resolveCanonicalColor(colorName);
    if (swatchImageUrl) {
      return {
        ...base,
        type: 'swatch',
        swatchImageUrl,
      };
    }
    if (hexPrimary && hexSecondary) {
      return {
        ...base,
        type: 'dual',
        hexPrimary,
        hexSecondary,
      };
    }
    if (hexPrimary) {
      return {
        ...base,
        type: 'solid',
        hexPrimary,
        hexCode: hexPrimary,
      };
    }
    return base;
  }, [colorName, hexPrimary, hexSecondary, swatchImageUrl]);

  if (!canonical || !canonical.displayName || canonical.canonicalName === 'unassigned') {
    return null;
  }

  const sizeClasses = {
    sm: 'w-4 h-4 text-[10px]',
    md: 'w-6 h-6 text-xs',
    lg: 'w-8 h-8 text-sm',
  }[size];

  const backgroundStyle = getSwatchBackground(canonical);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${canonical.displayName}${selected ? ' — selected' : ''}${disabled ? ' (Unavailable)' : ''}`}
      title={`${canonical.displayName}${selected ? ' — currently selected' : ''}${disabled ? ' — Out of stock' : ''}`}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={`group relative inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B88E3E] transition-transform active:scale-95 cursor-pointer ${
        disabled ? 'cursor-not-allowed opacity-45' : ''
      } ${className}`}
    >
      <span
        className={`relative inline-block rounded-full border transition-all duration-200 ${sizeClasses} ${
          selected
            ? 'ring-2 ring-[#B88E3E] ring-offset-2 ring-offset-[#FAF8F5] border-[#1C1917] scale-105'
            : 'border-[#1C1917]/25 hover:border-[#1C1917]/70'
        }`}
        style={{
          background: backgroundStyle,
        }}
      >
        {/* Subtle diagonal strike-through if disabled/sold-out */}
        {disabled && (
          <span className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full">
            <span className="w-[140%] h-[1.5px] bg-[#78281F] rotate-45 transform" />
          </span>
        )}
      </span>

      {showLabel && (
        <span
          className={`text-xs capitalize font-medium tracking-tight ${
            selected ? 'text-[#1C1917] font-semibold' : 'text-[#78716C] group-hover:text-[#1C1917]'
          }`}
        >
          {canonical.displayName}
        </span>
      )}
    </button>
  );
};
