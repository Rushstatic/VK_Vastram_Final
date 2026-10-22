import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Product } from '../../types';
import { ProductCard } from './ProductCard';
import { Container } from '../ui/Container';

interface HorizontalProductRailProps {
  title: string;
  subtitle?: string;
  kicker?: string;
  actionText?: string;
  onActionClick?: () => void;
  products: Product[];
  wishlistIds?: string[];
  onToggleWishlist?: (product: Product) => void;
  onSelectProduct?: (slug: string) => void;
  onQuickView?: (product: Product) => void;
  onAddToCart?: (product: Product, quantity?: number, color?: string, size?: string, variantId?: string) => void;
  className?: string;
}

export const HorizontalProductRail: React.FC<HorizontalProductRailProps> = ({
  title,
  subtitle,
  kicker,
  actionText,
  onActionClick,
  products,
  wishlistIds = [],
  onToggleWishlist,
  onSelectProduct,
  onQuickView,
  onAddToCart,
  className = '',
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  if (!products || products.length === 0) {
    return null;
  }

  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const cardWidth = container.clientWidth * 0.75;
    const scrollAmount = direction === 'left' ? -cardWidth : cardWidth;
    container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  return (
    <section className={`py-12 sm:py-16 ${className}`}>
      <Container>
        {/* Rail Header */}
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-[#1C1917]/10">
          <div>
            {kicker && (
              <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-[#967029] font-medium block mb-1">
                {kicker}
              </span>
            )}
            <h3 className="font-serif text-xl sm:text-2xl text-[#1C1917] font-normal">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-[#78716C] mt-1 max-w-xl">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {actionText && onActionClick && (
              <button
                onClick={onActionClick}
                className="vk-cta-blink px-2.5 py-1 text-xs text-[#967029] hover:text-[#1C1917] transition-colors cursor-pointer font-medium whitespace-nowrap"
              >
                {actionText}
              </button>
            )}

            {/* Scroll Navigation Arrows (Desktop) */}
            <div className="hidden sm:flex items-center gap-1.5 ml-2">
              <button
                type="button"
                onClick={() => handleScroll('left')}
                aria-label="Scroll left"
                className="w-8 h-8 rounded-full border border-[#1C1917]/15 flex items-center justify-center text-[#1C1917] hover:border-[#1C1917] hover:bg-[#FAF8F5] transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleScroll('right')}
                aria-label="Scroll right"
                className="w-8 h-8 rounded-full border border-[#1C1917]/15 flex items-center justify-center text-[#1C1917] hover:border-[#1C1917] hover:bg-[#FAF8F5] transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Track */}
        <div
          ref={scrollContainerRef}
          className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scroll-smooth scrollbar-thin scrollbar-thumb-stone-300"
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'thin',
          }}
        >
          {products.slice(0, 10).map((product) => (
            <div
              key={product.id}
              className="w-[62vw] sm:w-[38vw] md:w-[28vw] lg:w-[22vw] shrink-0 snap-start"
            >
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
      </Container>
    </section>
  );
};
