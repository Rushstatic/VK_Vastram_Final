/**
 * Image helper utility for VK VASTRAM storefront
 * Ensures all image paths (Supabase Storage, CDN, public assets, or Vite bundles)
 * resolve reliably in production deployments without breaking.
 */

import heroVastramSaree from '../assets/images/hero_vastram_saree_1791192126882.jpg';
import banarasiSaree from '../assets/images/product_banarasi_saree_1791192143761.jpg';
import chanderiSaree from '../assets/images/product_chanderi_saree_1791192155766.jpg';
import bedsheetCotton from '../assets/images/product_bedsheet_cotton_1791192169249.jpg';
import craftDetail from '../assets/images/craft_textile_detail_1791192181572.jpg';
import vkEmblem from '../assets/images/vk_emblem_small_1791213158854.jpg';

const LOCAL_ASSET_MAP: Record<string, string> = {
  'hero_vastram_saree_1791192126882.jpg': heroVastramSaree,
  'product_banarasi_saree_1791192143761.jpg': banarasiSaree,
  'product_chanderi_saree_1791192155766.jpg': chanderiSaree,
  'product_bedsheet_cotton_1791192169249.jpg': bedsheetCotton,
  'craft_textile_detail_1791192181572.jpg': craftDetail,
  'vk_emblem_small_1791213158854.jpg': vkEmblem,
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const DEFAULT_BUCKET = 'store-assets';

export function normalizeImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const trimmed = url.trim();
  if (!trimmed) return '';

  // 1. Check if it references a local bundled image filename
  for (const [filename, bundledUrl] of Object.entries(LOCAL_ASSET_MAP)) {
    if (trimmed.includes(filename)) {
      return bundledUrl;
    }
  }

  // 2. Google Drive share links are not direct image URLs. Convert common share
  // formats to the public file endpoint used by <img> elements.
  if (/^(https?:\/\/)?(drive\.google\.com|docs\.google\.com)\//i.test(trimmed)) {
    const idFromPath = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1];
    const idFromQuery = (() => {
      try { return new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`).searchParams.get('id'); }
      catch { return null; }
    })();
    const driveId = idFromPath || idFromQuery;
    if (driveId) return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(driveId)}`;
  }

  // 3. Reject stale preview/local-development URLs saved into product records.
  // URLs such as http://localhost:37857/123.png only exist inside the uploader's
  // temporary dev session and always fail for real customers. Never request them.
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const hostname = parsed.hostname.toLowerCase();
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1') {
        return '';
      }
      return trimmed;
    } catch {
      return '';
    }
  }
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  // 4. Repair relative Supabase Storage URLs emitted by older imports.
  // Example: /storage/v1/object/public/store-assets/catalog/saree.jpg
  const relativeStorage = trimmed.match(/^\/?storage\/v1\/object\/public\/([^/]+)\/(.+)$/i);
  if (relativeStorage && SUPABASE_URL) {
    return `${SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/${relativeStorage[1]}/${relativeStorage[2].split('/').map(encodeURIComponent).join('/')}`;
  }

  // 5. Base64 data URL
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  // 6. Vite asset bundle URL (e.g. /assets/xxx.jpg or /@fs/...)
  if (trimmed.startsWith('/assets/') || trimmed.startsWith('/@fs/')) {
    return trimmed;
  }

  // 7. Supabase Storage path resolution
  if (SUPABASE_URL && !SUPABASE_URL.includes('placeholder') && !SUPABASE_URL.includes('your-project')) {
    const cleanPath = trimmed.startsWith(`${DEFAULT_BUCKET}/`)
      ? trimmed.slice(DEFAULT_BUCKET.length + 1)
      : trimmed.replace(/^\/+/, '');

    return `${SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/${DEFAULT_BUCKET}/${cleanPath}`;
  }

  return trimmed;
}

export function getPublicStorageUrl(storagePath: string, bucket = DEFAULT_BUCKET): string {
  if (!storagePath) return '';
  if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
    return storagePath;
  }
  if (!SUPABASE_URL || SUPABASE_URL.includes('placeholder')) {
    return storagePath;
  }
  return `${SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${storagePath.replace(/^\/+/, '')}`;
}
