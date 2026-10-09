import { Product } from '../types';

/**
 * Deterministic PRNG using Mulberry32 algorithm
 */
function createMulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Gets or creates a persistent discovery seed for this browser session.
 */
export function getSessionDiscoverySeed(): number {
  if (typeof window === 'undefined') return 18500;

  try {
    const key = 'vk_discovery_session_seed';
    const existing = window.sessionStorage.getItem(key);
    if (existing) {
      const parsed = parseInt(existing, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }

    // Generate stable seed for this session based on date and entropy
    const newSeed = Math.floor(Math.random() * 1000000) + 1;
    window.sessionStorage.setItem(key, String(newSeed));
    return newSeed;
  } catch {
    return 42890;
  }
}

/**
 * Orders products for storefront discovery:
 * 1. Active products only
 * 2. In-stock products receive strong discovery priority
 * 3. Deterministic session shuffle preserves stability while introducing freshness
 * 4. Out-of-stock items remain discoverable at the end
 */
export function getDiscoveryOrderedProducts(products: Product[]): Product[] {
  if (!products || products.length === 0) return [];

  const seed = getSessionDiscoverySeed();
  const rng = createMulberry32(seed);

  // Filter active products
  const active = products.filter((p) => p.status !== 'archived');

  // Split into in-stock and out-of-stock
  const inStock: Product[] = [];
  const outOfStock: Product[] = [];

  for (const p of active) {
    if (p.inStock !== false && (p.stockQuantity === undefined || p.stockQuantity > 0)) {
      inStock.push(p);
    } else {
      outOfStock.push(p);
    }
  }

  // Shuffle function with seeded RNG
  const seededShuffle = (arr: Product[]) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  // High-priority featured items at top (if marked featured and in-stock)
  const featuredInStock = inStock.filter((p) => p.featured);
  const regularInStock = inStock.filter((p) => !p.featured);

  return [
    ...seededShuffle(featuredInStock),
    ...seededShuffle(regularInStock),
    ...outOfStock,
  ];
}
