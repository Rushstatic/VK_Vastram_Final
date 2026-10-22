import React, { useEffect, useMemo, useState } from 'react';
import { Product } from '../../types';
import { ProductCard } from '../catalog/ProductCard';
import { Button } from '../ui/Button';
import { ArrowRight } from 'lucide-react';

/** How often the homepage selection changes. Every visitor sees the same set within one slot. */
export const ROTATION_MS = 2 * 60 * 1000;
export const SHOWN_COUNT = 12;

/** Small deterministic string hash (FNV-1a). Same input always gives the same number. */
const hash = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
};

/**
 * Picks `count` products for the current 2-minute slot. The ordering is a hash of
 * (slot, product id), so the set changes every slot, is the same for all visitors in that slot,
 * and needs no server or database writes.
 */
export const pickRotatingProducts = (pool: Product[], count: number, slot: number): Product[] =>
  [...pool]
    .sort((a, b) => hash(`${slot}:${a.id}`) - hash(`${slot}:${b.id}`))
    .slice(0, count);

interface MostLovedStylesProps {
  products: Product[];
  wishlistIds: string[];
  onToggleWishlist: (product: Product) => void;
  onSelectProduct: (slug: string) => void;
  onQuickView: (product: Product) => void;
  onAddToCart: (product: Product, quantity?: number, color?: string, size?: string, variantId?: string) => void;
  onViewAll: () => void;
}

export const MostLovedStyles: React.FC<MostLovedStylesProps> = ({
  products, wishlistIds, onToggleWishlist, onSelectProduct, onQuickView, onAddToCart, onViewAll,
}) => {
  const [slot, setSlot] = useState(() => Math.floor(Date.now() / ROTATION_MS));

  // Check once a second whether a new slot has started (cheap, and keeps tabs in sync after sleep).
  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = Math.floor(Date.now() / ROTATION_MS);
      setSlot((previous) => (previous === current ? previous : current));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Only sarees with a photo are shown on the homepage.
  const pool = useMemo(
    () => products.filter((p) => p.category === 'sarees' && p.primaryImage),
    [products]
  );
  const shown = useMemo(() => pickRotatingProducts(pool, SHOWN_COUNT, slot), [pool, slot]);

  // Nothing to show: render nothing (never a "coming soon" message on the homepage).
  if (shown.length === 0) return null;

  return (
    <section className="py-10 sm:py-16 lg:py-20 bg-[#FAF8F5]" aria-labelledby="most-loved-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center gap-4 mb-8 sm:mb-10 text-center">
          <span className="hidden sm:block h-px flex-1 bg-[#1C1917]/15" aria-hidden="true" />
          <div>
            <h2 id="most-loved-heading" className="font-sans text-xl sm:text-3xl tracking-[0.18em] uppercase text-[#1C1917] font-normal">
              Most Loved Styles
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#57534E]">Here's some of our most popular sarees people are in love with.</p>
          </div>
          <span className="hidden sm:block h-px flex-1 bg-[#1C1917]/15" aria-hidden="true" />
        </div>

        {/* 12 products: 2 per row on phones (6 rows), 6 per row on desktop (2 rows). */}
        <div key={slot} className="grid grid-cols-2 lg:grid-cols-6 gap-x-3 gap-y-6 sm:gap-x-5">
          {shown.map((product) => (
            <div key={product.id} className="min-w-0">
              <ProductCard
                product={product}
                isWishlisted={wishlistIds.includes(product.id)}
                onToggleWishlist={onToggleWishlist}
                onSelectProduct={onSelectProduct}
                onQuickView={onQuickView}
                onAddToCart={onAddToCart}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-center mt-8 sm:mt-10">
          <Button
            variant="outline"
            size="md"
            onClick={onViewAll}
            rightIcon={<ArrowRight className="w-4 h-4" />}
            className="vk-cta-blink uppercase tracking-[0.14em]"
          >
            View All
          </Button>
        </div>
      </div>
    </section>
  );
};
