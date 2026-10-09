import React, { useState } from 'react';
import { Upload, X, Loader2, CheckCircle2, AlertCircle, Sparkles, Sliders } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { optimizeImageBeforeUpload, formatBytes, ImageOptimizationResult } from '../../lib/imageOptimizer';
import { ImageAdjustmentControl } from './ImageAdjustmentControl';

interface MediaUploaderProps {
  value?: string;
  onChange: (url: string) => void;
  folder: 'logo' | 'homepage' | 'banners' | 'collections' | 'categories' | 'products' | 'pages';
  label: string;
  recommendedSize?: string;
  allowImageAdjustment?: boolean;
  fit?: 'cover' | 'contain';
  focalPositionX?: string;
  focalPositionY?: string;
  scale?: number;
  onAdjustmentChange?: (settings: {
    fit: 'cover' | 'contain';
    focalPositionX: string;
    focalPositionY: string;
    scale: number;
  }) => void;
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  value,
  onChange,
  folder,
  label,
  recommendedSize,
  allowImageAdjustment = false,
  fit = 'cover',
  focalPositionX = 'center',
  focalPositionY = 'center',
  scale = 1.0,
  onAdjustmentChange,
}) => {
  const [processingState, setProcessingState] = useState<'idle' | 'optimizing' | 'uploading'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [optResult, setOptResult] = useState<ImageOptimizationResult | null>(null);
  const [showAdjustments, setShowAdjustments] = useState(false);

  // Standard Guidance helper according to Prompt 26B
  const defaultGuidance = React.useMemo(() => {
    if (recommendedSize) return recommendedSize;
    switch (folder) {
      case 'products':
        return 'Recommended 1200 × 1600 px · Ratio 3:4 · One source image';
      case 'categories':
      case 'collections':
        return 'Recommended 800 × 1066 px · Ratio 3:4 · One source image';
      case 'homepage':
        return 'Desktop: 1440 × 900 px / Mobile: 750 × 562 px · One source image default';
      case 'banners':
      case 'pages':
        return 'Recommended 1200 × 900 px · Ratio 4:3 · One source image';
      case 'logo':
        return 'Recommended 400 × 400 px · Square';
      default:
        return 'High quality source · One source image';
    }
  }, [folder, recommendedSize]);

  const fileToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    // Validate type
    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validMimes.includes(rawFile.type.toLowerCase()) && !rawFile.name.match(/\.(jpg|jpeg|png|webp)$/i)) {
      setError('Unsupported file type. Please upload a JPEG, PNG, or WebP image.');
      return;
    }

    // Safety limit: 20MB source file (sufficient for high-res DSLR/phone photos)
    if (rawFile.size > 20 * 1024 * 1024) {
      setError('Image file is extremely large (exceeds 20MB). Please select an image under 20MB.');
      return;
    }

    setError(null);
    setProcessingState('optimizing');

    try {
      // 1. Client-Side Standardized Image Optimization (WebP, max bounds, no blind cropping)
      const optimized = await optimizeImageBeforeUpload(rawFile, { folder });
      setOptResult(optimized);

      setProcessingState('uploading');

      // 2. Prepare base64 for secure backend API upload
      const base64Data = await fileToBase64(optimized.blob);
      const session = await supabase.auth.getSession();
      const token = session.data?.session?.access_token || '';

      const res = await fetch('/api/admin/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fileData: base64Data,
          filename: optimized.file.name,
          folder,
          contentType: optimized.format,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.url) {
          onChange(data.url);
          setProcessingState('idle');
          return;
        }
      }

      // 3. Direct client Supabase Storage fallback if backend route returned non-200
      const ext = optimized.format === 'image/webp' ? 'webp' : optimized.file.name.split('.').pop() || 'jpg';
      const cleanName = rawFile.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      const storagePath = `${folder}/${Date.now()}-${cleanName}.${ext}`;

      const { error: directUploadError } = await (supabase as any).storage
        .from('store-assets')
        .upload(storagePath, optimized.blob, { contentType: optimized.format, upsert: true });

      if (directUploadError) {
        throw new Error(directUploadError.message || 'Storage upload failed');
      }

      const { data: publicUrlData } = (supabase as any).storage
        .from('store-assets')
        .getPublicUrl(storagePath);

      if (publicUrlData?.publicUrl) {
        onChange(publicUrlData.publicUrl);
      } else {
        throw new Error('Could not retrieve public URL from Supabase Storage.');
      }
    } catch (err: any) {
      console.error('Media upload error:', err);
      setError(err.message || 'Failed to process and upload image. Please try again.');
    } finally {
      setProcessingState('idle');
    }
  };

  const isSupabaseAsset = Boolean(value && value.includes('supabase.co/storage'));
  const isBusy = processingState !== 'idle';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block font-semibold text-[#1C1917] text-xs">{label}</label>
        <span className="text-[10px] text-[#78716C] font-medium">{defaultGuidance}</span>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3 bg-[#FAF8F5] border border-[#1C1917]/10 rounded-xs">
        {/* Preview Container */}
        {value ? (
          <div className="relative w-20 h-24 rounded-xs overflow-hidden border border-[#1C1917]/15 bg-[#F4EFE6] shrink-0">
            <img
              src={value}
              alt="Preview"
              className="w-full h-full"
              style={{
                objectFit: fit,
                objectPosition: `${focalPositionX === 'left' ? '0%' : focalPositionX === 'right' ? '100%' : '50%'} ${focalPositionY === 'top' ? '0%' : focalPositionY === 'bottom' ? '100%' : '50%'}`,
                transform: `scale(${scale})`,
              }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="96"><rect width="80" height="96" fill="%23ece5d8"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="10" fill="%2378716c">Broken</text></svg>';
              }}
            />
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOptResult(null);
                setError(null);
              }}
              className="absolute top-0 right-0 bg-[#1C1917]/80 hover:bg-[#1C1917] text-white p-1 rounded-bl-xs transition-colors cursor-pointer"
              title="Remove media"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="w-20 h-24 bg-[#F4EFE6] border border-dashed border-[#1C1917]/25 flex items-center justify-center rounded-xs shrink-0">
            <Upload className="w-6 h-6 text-[#A8A29E]" />
          </div>
        )}

        {/* Action Controls & Metadata */}
        <div className="flex-1 min-w-0 space-y-1.5 w-full">
          <div className="flex flex-wrap items-center gap-2">
            <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F4EFE6] hover:bg-[#EFE9DC] text-[#1C1917] text-xs font-medium rounded-xs border border-[#1C1917]/15 cursor-pointer transition-colors ${
              isBusy ? 'opacity-60 pointer-events-none' : ''
            }`}>
              <Upload className="w-3.5 h-3.5 text-[#967029]" />
              <span>{value ? 'Replace Image' : 'Upload Image'}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleUpload}
                disabled={isBusy}
                className="hidden"
              />
            </label>

            {value && allowImageAdjustment && onAdjustmentChange && (
              <button
                type="button"
                onClick={() => setShowAdjustments(!showAdjustments)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#F4EFE6] hover:bg-[#EFE9DC] text-[#1C1917] text-xs font-medium rounded-xs border border-[#1C1917]/15 cursor-pointer transition-colors"
                title="Adjust fit, focal position & scale"
              >
                <Sliders className="w-3.5 h-3.5 text-[#967029]" />
                <span>{showAdjustments ? 'Hide Tuning' : 'Tune Framing'}</span>
              </button>
            )}

            {value && !isBusy && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="px-2.5 py-1.5 text-xs text-[#78716C] hover:text-red-700 hover:bg-red-50 rounded-xs transition-colors cursor-pointer"
              >
                Remove
              </button>
            )}
          </div>

          {/* Feedback states */}
          {processingState === 'optimizing' && (
            <div className="flex items-center gap-2 text-xs text-[#967029] font-medium animate-pulse">
              <Sparkles className="w-3.5 h-3.5 text-[#967029]" />
              <span>Optimizing image (WebP, detail-preserving resize)...</span>
            </div>
          )}

          {processingState === 'uploading' && (
            <div className="flex items-center gap-2 text-xs text-[#967029] font-medium animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Uploading to Supabase Storage ({folder}/)...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 p-1.5 rounded-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{error}</span>
            </div>
          )}

          {!isBusy && !error && value && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{isSupabaseAsset ? '✓ Stored in Supabase Storage' : 'Active Image Reference'}</span>
              </div>
              {optResult && (
                <div className="text-[10px] text-[#57534E] font-mono bg-[#EDE6D8]/60 px-2 py-1 rounded-xs flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>Orig: {formatBytes(optResult.originalSize)} ({optResult.originalDimensions.width}×{optResult.originalDimensions.height})</span>
                  <span>→</span>
                  <span className="text-emerald-800 font-semibold">Opt: {formatBytes(optResult.optimizedSize)} ({optResult.optimizedDimensions.width}×{optResult.optimizedDimensions.height}, {optResult.format.replace('image/', '').toUpperCase()})</span>
                  {optResult.reductionPercent > 0 && (
                    <span className="text-emerald-700 font-medium">({optResult.reductionPercent}% saved)</span>
                  )}
                </div>
              )}
            </div>
          )}

          <p className="text-[10px] text-[#78716C]">
            JPEG, PNG, or WebP. Auto-optimized to WebP for sharp textile clarity & fast loading.
          </p>
        </div>
      </div>

      {/* Expandable Image Adjustment Control */}
      {showAdjustments && value && allowImageAdjustment && onAdjustmentChange && (
        <div className="pt-2">
          <ImageAdjustmentControl
            imageUrl={value}
            fit={fit}
            focalPositionX={focalPositionX}
            focalPositionY={focalPositionY}
            scale={scale}
            onChange={onAdjustmentChange}
            title={`${label} — Focal Framing & Responsive Fit`}
          />
        </div>
      )}
    </div>
  );
};
