/**
 * SKU Standardization and Ledger Utility for VK VASTRAM
 *
 * Rules:
 * Parent Catalog SKUs:
 * - Sarees: VKV-SAR-001
 * - Bedsheets: VKV-BED-001
 * - Home Textiles: VKV-TEX-001
 *
 * Variant SKUs:
 * - Format: ${parentSku}-01, ${parentSku}-02, ${parentSku}-03
 * - Strict uniqueness, never duplicate SKUs.
 */

export function formatVariantSku(parentSku: string, index: number): string {
  const cleanParent = (parentSku || 'VKV-SAR-001')
    .trim()
    .replace(/-V\d+$/i, '')
    .replace(/-\d{2}$/, '');
  const suffix = String(index).padStart(2, '0');
  return `${cleanParent}-${suffix}`;
}

export function parseNextVariantIndex(variants: { sku?: string }[]): number {
  if (!variants || variants.length === 0) return 1;

  const suffixes = variants
    .map((v) => {
      if (!v.sku) return 0;
      const match = v.sku.match(/-(\d{2})$/) || v.sku.match(/-V(\d+)$/i);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => !isNaN(n));

  const maxSuffix = suffixes.length > 0 ? Math.max(...suffixes) : 0;
  return Math.max(variants.length + 1, maxSuffix + 1);
}
