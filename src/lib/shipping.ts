import type { SiteSettingsData } from '../services/siteSettingsService';

export function normalizeIndianState(value?: string | null): string {
  return String(value || '').trim().toLowerCase().replace(/^in[- ]/, '').replace(/,.*$/, '').replace(/\s+state$/, '').trim();
}

export function calculateShippingAmount(
  subtotal: number,
  state: string | null | undefined,
  settings: Pick<SiteSettingsData, 'freeShippingThreshold' | 'maharashtraShipping' | 'otherStateShipping'>
): number {
  const threshold = Math.max(0, Number(settings.freeShippingThreshold) || 0);
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  if (threshold > 0 && safeSubtotal >= threshold) return 0;
  const normalized = normalizeIndianState(state);
  return Math.max(0, normalized === 'maharashtra' || normalized === 'mh'
    ? Number(settings.maharashtraShipping) || 0
    : Number(settings.otherStateShipping) || 0);
}
