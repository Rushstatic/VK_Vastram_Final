/**
 * VK VASTRAM Standardized Production Image Optimization Pipeline
 * 
 * Rules:
 * 1. Product images: Max 1200 x 1600 px (longest dimension <= 1600px).
 * 2. Target WebP format with 85% quality (82-88% range for crisp fabric/zari/border details).
 * 3. Never upscale low-resolution images.
 * 4. Never blindly crop: preserves native aspect ratio and all textile motif/blouse details.
 * 5. Handles large source images (e.g. 5-10MB phone camera shots) smoothly.
 * 6. Preserves transparency for logos (PNG/WebP).
 */

export interface ImageOptimizationOptions {
  folder?: 'products' | 'logo' | 'homepage' | 'banners' | 'collections' | 'categories' | 'pages';
  maxDimension?: number;
  maxDimensionWidth?: number;
  maxDimensionHeight?: number;
  quality?: number; // 0.0 to 1.0 (default 0.85)
  targetFormat?: 'image/webp' | 'image/jpeg' | 'image/png';
  preserveTransparency?: boolean;
}

export interface ImageOptimizationResult {
  file: File;
  blob: Blob;
  originalDimensions: { width: number; height: number };
  optimizedDimensions: { width: number; height: number };
  originalSize: number; // bytes
  optimizedSize: number; // bytes
  reductionPercent: number;
  format: string; // 'image/webp' | 'image/jpeg' | 'image/png'
  dataUrl: string;
}

/**
 * Get folder-specific optimization configuration
 */
export function getFolderOptimizationOptions(
  folder: 'products' | 'logo' | 'homepage' | 'banners' | 'collections' | 'categories' | 'pages' = 'products'
): ImageOptimizationOptions {
  switch (folder) {
    case 'products':
      return {
        folder: 'products',
        maxDimension: 1600,
        maxDimensionWidth: 1200,
        maxDimensionHeight: 1600,
        quality: 0.85,
        targetFormat: 'image/webp',
        preserveTransparency: false,
      };
    case 'logo':
      return {
        folder: 'logo',
        maxDimension: 800,
        maxDimensionWidth: 800,
        maxDimensionHeight: 800,
        quality: 0.92,
        targetFormat: 'image/webp',
        preserveTransparency: true,
      };
    case 'homepage':
    case 'banners':
      return {
        folder,
        maxDimension: 2000,
        maxDimensionWidth: 2000,
        maxDimensionHeight: 2000,
        quality: 0.85,
        targetFormat: 'image/webp',
        preserveTransparency: false,
      };
    case 'collections':
    case 'categories':
    case 'pages':
    default:
      return {
        folder,
        maxDimension: 1400,
        maxDimensionWidth: 1400,
        maxDimensionHeight: 1400,
        quality: 0.85,
        targetFormat: 'image/webp',
        preserveTransparency: false,
      };
  }
}

/**
 * Optimize an image file client-side before upload to Supabase Storage
 */
export async function optimizeImageBeforeUpload(
  file: File,
  customOptions?: Partial<ImageOptimizationOptions>
): Promise<ImageOptimizationResult> {
  const folder = customOptions?.folder || 'products';
  const defaultOpts = getFolderOptimizationOptions(folder);
  const options: ImageOptimizationOptions = { ...defaultOpts, ...customOptions };

  // 1. Validate MIME type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!validTypes.includes(file.type.toLowerCase()) && !file.name.match(/\.(jpg|jpeg|png|webp)$/i)) {
    throw new Error('Unsupported image format. Please select a JPEG, PNG, or WebP image.');
  }

  // 2. Load image into HTMLImageElement
  const dataUrl = await readFileAsDataURL(file);
  const img = await loadImageElement(dataUrl);

  const origWidth = img.naturalWidth || img.width;
  const origHeight = img.naturalHeight || img.height;

  if (!origWidth || !origHeight) {
    throw new Error('Unable to determine image dimensions. The image file may be corrupted.');
  }

  // 3. Compute optimal dimensions preserving aspect ratio (NO BLIND CROPPING)
  let targetWidth = origWidth;
  let targetHeight = origHeight;

  const maxDimension = options.maxDimension || 1600;
  const maxW = options.maxDimensionWidth || maxDimension;
  const maxH = options.maxDimensionHeight || maxDimension;

  // Check if image exceeds maximum allowable bounding box
  if (origWidth > maxW || origHeight > maxH) {
    const widthRatio = maxW / origWidth;
    const heightRatio = maxH / origHeight;
    const resizeRatio = Math.min(widthRatio, heightRatio);

    // Downscale proportionally (never upscale)
    if (resizeRatio < 1.0) {
      targetWidth = Math.max(1, Math.round(origWidth * resizeRatio));
      targetHeight = Math.max(1, Math.round(origHeight * resizeRatio));
    }
  }

  // 4. Determine optimal target format
  const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
  let targetFormat = options.targetFormat || 'image/webp';
  const quality = options.quality ?? 0.85;

  // 5. Draw to Canvas with high quality smoothing
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { alpha: Boolean(options.preserveTransparency && isPng) });

  if (!ctx) {
    throw new Error('Canvas 2D context is not supported in this browser.');
  }

  // Enable high-quality image smoothing for textile detail
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // If transparent PNG and not preserving transparency, fill with clean background
  if (!options.preserveTransparency && isPng) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  // 6. Convert to optimized Blob
  let optimizedBlob: Blob | null = null;

  try {
    optimizedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        targetFormat,
        quality
      );
    });
  } catch (canvasErr) {
    console.warn('Direct WebP canvas export failed, attempting JPEG fallback:', canvasErr);
  }

  // If WebP is unsupported or failed, fallback to JPEG/PNG
  if (!optimizedBlob || optimizedBlob.size === 0) {
    targetFormat = isPng && options.preserveTransparency ? 'image/png' : 'image/jpeg';
    optimizedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), targetFormat, quality);
    });
  }

  if (!optimizedBlob) {
    throw new Error('Failed to generate optimized image blob.');
  }

  // 7. Generate clean optimized filename with .webp or original extension
  const ext = targetFormat === 'image/webp' ? 'webp' : targetFormat === 'image/png' ? 'png' : 'jpg';
  const cleanBaseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const optimizedFileName = `${cleanBaseName}.${ext}`;

  const optimizedFile = new File([optimizedBlob], optimizedFileName, {
    type: targetFormat,
    lastModified: Date.now(),
  });

  const originalSize = file.size;
  const optimizedSize = optimizedBlob.size;
  const reductionPercent = Math.max(
    0,
    Math.round(((originalSize - optimizedSize) / originalSize) * 100)
  );

  const optimizedDataUrl = canvas.toDataURL(targetFormat, quality);

  return {
    file: optimizedFile,
    blob: optimizedBlob,
    originalDimensions: { width: origWidth, height: origHeight },
    optimizedDimensions: { width: targetWidth, height: targetHeight },
    originalSize,
    optimizedSize,
    reductionPercent,
    format: targetFormat,
    dataUrl: optimizedDataUrl,
  };
}

/**
 * Format bytes to readable size string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file as Data URL.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image data into HTMLImageElement.'));
    img.src = src;
  });
}
