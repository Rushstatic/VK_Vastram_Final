import { Product } from '../types';
import { resolveCanonicalColor } from './colorSystem';

/**
 * Calculates similarity score between current product and candidate product.
 */
function calculateProductSimilarity(target: Product, candidate: Product): number {
  if (target.id === candidate.id || target.slug === candidate.slug) {
    return -1; // Never recommend self
  }

  let score = 0;

  // Category match is critical (sarees recommend sarees, bedsheets recommend bedsheets)
  if (target.category === candidate.category) {
    score += 50;
  } else {
    return -1; // Do not recommend cross-category for complementary creations
  }

  // Same subcategory / weave (e.g. Banarasi, Kanjivaram)
  if (target.subCategory && candidate.subCategory && target.subCategory === candidate.subCategory) {
    score += 25;
  }

  // Same collection
  if (target.collectionId && candidate.collectionId && target.collectionId === candidate.collectionId) {
    score += 20;
  }

  // Similar fabric
  if (target.fabric && candidate.fabric) {
    const targetWords = target.fabric.toLowerCase().split(/\s+/);
    const candidateWords = candidate.fabric.toLowerCase().split(/\s+/);
    const overlap = targetWords.filter((w) => w.length > 3 && candidateWords.includes(w));
    score += overlap.length * 8;
  }

  // Similar color family
  if (target.colors && candidate.colors && target.colors.length > 0 && candidate.colors.length > 0) {
    const targetFamilies = target.colors.map((c) => resolveCanonicalColor(c).family);
    const candidateFamilies = candidate.colors.map((c) => resolveCanonicalColor(c).family);
    const hasFamilyOverlap = targetFamilies.some((f) => candidateFamilies.includes(f));
    if (hasFamilyOverlap) {
      score += 15;
    }
  }

  // Similar price range (within ±35%)
  if (target.price > 0 && candidate.price > 0) {
    const ratio = Math.abs(target.price - candidate.price) / target.price;
    if (ratio < 0.25) {
      score += 15;
    } else if (ratio < 0.5) {
      score += 8;
    }
  }

  // In-stock boost
  if (candidate.inStock !== false && (candidate.stockQuantity === undefined || candidate.stockQuantity > 0)) {
    score += 10;
  }

  // Featured / bestseller boost
  if (candidate.featured || candidate.bestSeller) {
    score += 5;
  }

  return score;
}

/**
 * Returns up to 10 complementary products sorted by similarity signals.
 */
export function getComplementaryProducts(
  targetProduct: Product,
  allProducts: Product[],
  limit = 10
): Product[] {
  if (!targetProduct || !allProducts || allProducts.length <= 1) {
    return [];
  }

  const scored = allProducts
    .map((candidate) => ({
      product: candidate,
      score: calculateProductSimilarity(targetProduct, candidate),
    }))
    .filter((item) => item.score > 0);

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((item) => item.product);
}
