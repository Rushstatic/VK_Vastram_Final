import React from 'react';
import { Eye, RotateCcw, Sliders, Maximize2 } from 'lucide-react';

export interface ImagePresentationSettings {
  fit: 'cover' | 'contain';
  focalPositionX: 'left' | 'left-center' | 'center' | 'right-center' | 'right' | string;
  focalPositionY: 'top' | 'upper' | 'center' | 'lower' | 'bottom' | string;
  scale?: number;
}

interface ImageAdjustmentControlProps {
  imageUrl?: string;
  fit?: 'cover' | 'contain';
  focalPositionX?: string;
  focalPositionY?: string;
  scale?: number;
  aspectRatio?: '3/4' | '16/10' | '4/3' | '16/9' | '1/1';
  onChange: (settings: {
    fit: 'cover' | 'contain';
    focalPositionX: string;
    focalPositionY: string;
    scale: number;
  }) => void;
  title?: string;
}

export const ImageAdjustmentControl: React.FC<ImageAdjustmentControlProps> = ({
  imageUrl,
  fit = 'cover',
  focalPositionX = 'center',
  focalPositionY = 'center',
  scale = 1.0,
  aspectRatio = '3/4',
  onChange,
  title = 'One-Source Responsive Image Tuning',
}) => {
  // Normalize focal position to standard CSS percentage
  const getFocalXCss = (pos: string) => {
    switch (pos) {
      case 'left':
        return '0%';
      case 'left-center':
      case '25%':
        return '25%';
      case 'right-center':
      case '75%':
        return '75%';
      case 'right':
        return '100%';
      case 'center':
      default:
        return '50%';
    }
  };

  const getFocalYCss = (pos: string) => {
    switch (pos) {
      case 'top':
        return '0%';
      case 'upper':
      case '25%':
        return '25%';
      case 'lower':
      case '75%':
        return '75%';
      case 'bottom':
        return '100%';
      case 'center':
      default:
        return '50%';
    }
  };

  const handleFitChange = (newFit: 'cover' | 'contain') => {
    onChange({ fit: newFit, focalPositionX, focalPositionY, scale });
  };

  const handleFocalXChange = (newX: string) => {
    onChange({ fit, focalPositionX: newX, focalPositionY, scale });
  };

  const handleFocalYChange = (newY: string) => {
    onChange({ fit, focalPositionX, focalPositionY: newY, scale });
  };

  const handleScaleChange = (newScale: number) => {
    onChange({ fit, focalPositionX, focalPositionY, scale: newScale });
  };

  const handleReset = () => {
    onChange({ fit: 'cover', focalPositionX: 'center', focalPositionY: 'center', scale: 1.0 });
  };

  const aspectClass = {
    '3/4': 'aspect-[3/4]',
    '16/10': 'aspect-[16/10]',
    '4/3': 'aspect-[4/3]',
    '16/9': 'aspect-[16/9]',
    '1/1': 'aspect-square',
  }[aspectRatio];

  if (!imageUrl) {
    return null;
  }

  return (
    <div className="bg-[#FAF8F5] border border-[#1C1917]/15 rounded-xs p-3.5 space-y-3.5">
      {/* Header with Title and Reset */}
      <div className="flex items-center justify-between border-b border-[#1C1917]/10 pb-2">
        <div className="flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-[#967029]" />
          <span className="text-xs font-semibold text-[#1C1917] tracking-tight">{title}</span>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1 text-[11px] text-[#78716C] hover:text-[#1C1917] transition-colors cursor-pointer"
          title="Reset to center defaults"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center">
        {/* Live Visual Preview Frame */}
        <div className="md:col-span-5 flex flex-col items-center">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-[#78716C] mb-1 flex items-center gap-1">
            <Eye className="w-3 h-3" />
            <span>Storefront Live Frame</span>
          </div>
          <div
            className={`w-full max-w-[220px] ${aspectClass} rounded-xs overflow-hidden border border-[#1C1917]/25 bg-[#EFE9DC] relative shadow-2xs`}
          >
            <img
              src={imageUrl}
              alt="Live presentation preview"
              className="w-full h-full transition-all duration-200"
              style={{
                objectFit: fit,
                objectPosition: `${getFocalXCss(focalPositionX)} ${getFocalYCss(focalPositionY)}`,
                transform: `scale(${scale})`,
              }}
            />
            {/* Focal grid guide */}
            <div className="absolute inset-0 pointer-events-none border border-white/20 grid grid-cols-3 grid-rows-3 opacity-30">
              <div className="border-r border-b border-white/20" />
              <div className="border-r border-b border-white/20" />
              <div className="border-b border-white/20" />
              <div className="border-r border-b border-white/20" />
              <div className="border-r border-b border-white/20" />
              <div className="border-b border-white/20" />
              <div className="border-r border-white/20" />
              <div className="border-r border-white/20" />
              <div />
            </div>
          </div>
          <p className="text-[10px] text-[#78716C] mt-1 text-center font-mono">
            {fit} · {focalPositionX} / {focalPositionY} · {Math.round(scale * 100)}%
          </p>
        </div>

        {/* Controls Grid */}
        <div className="md:col-span-7 grid grid-cols-2 gap-2.5 text-xs">
          {/* 1. Fit Control */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#1C1917] mb-1">
              Container Fit
            </label>
            <select
              value={fit}
              onChange={(e) => handleFitChange(e.target.value as 'cover' | 'contain')}
              className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-1.5 rounded-xs text-[#1C1917] text-xs cursor-pointer focus:outline-none focus:border-[#967029]"
            >
              <option value="cover">Cover (Fill & Crop safely)</option>
              <option value="contain">Contain (Full Image visible)</option>
            </select>
          </div>

          {/* 2. Scale / Zoom */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#1C1917] mb-1">
              Zoom Scale ({Math.round(scale * 100)}%)
            </label>
            <select
              value={scale}
              onChange={(e) => handleScaleChange(Number(e.target.value))}
              className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-1.5 rounded-xs text-[#1C1917] text-xs cursor-pointer focus:outline-none focus:border-[#967029]"
            >
              <option value={1.0}>1.0× (100% Native)</option>
              <option value={1.05}>1.05× (+5% Crop Fill)</option>
              <option value={1.1}>1.10× (+10% Focus)</option>
              <option value={1.15}>1.15× (+15% Emphasis)</option>
              <option value={1.2}>1.20× (+20% Close-up)</option>
            </select>
          </div>

          {/* 3. Horizontal Focal Position */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#1C1917] mb-1">
              Horizontal Focus (X)
            </label>
            <select
              value={focalPositionX}
              onChange={(e) => handleFocalXChange(e.target.value)}
              className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-1.5 rounded-xs text-[#1C1917] text-xs cursor-pointer focus:outline-none focus:border-[#967029]"
            >
              <option value="left">Left (0%)</option>
              <option value="left-center">Left-Center (25%)</option>
              <option value="center">Center (50%)</option>
              <option value="right-center">Right-Center (75%)</option>
              <option value="right">Right (100%)</option>
            </select>
          </div>

          {/* 4. Vertical Focal Position */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#1C1917] mb-1">
              Vertical Focus (Y)
            </label>
            <select
              value={focalPositionY}
              onChange={(e) => handleFocalYChange(e.target.value)}
              className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-1.5 rounded-xs text-[#1C1917] text-xs cursor-pointer focus:outline-none focus:border-[#967029]"
            >
              <option value="top">Top (0%)</option>
              <option value="upper">Upper (25%)</option>
              <option value="center">Center (50%)</option>
              <option value="lower">Lower (75%)</option>
              <option value="bottom">Bottom (100%)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
