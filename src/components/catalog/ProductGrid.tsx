import React from 'react';
import { Product } from '../../types';
import { ProductCard } from './ProductCard';
import { ScrollReveal } from '../ui/ScrollReveal';

interface ProductGridProps {
  products: Product[];
  wishlistIds?: string[];
  columns?: 3 | 4;
  onToggleWishlist?: (product: Product) => void;
  onSelectProduct?: (slug: string) => void;
  onQuickView?: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
  loading?: boolean;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  wishlistIds = [],
  columns = 3,
  onToggleWishlist,
  onSelectProduct,
  onQuickView,
  onAddToCart,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className={`grid grid-cols-2 ${columns === 4 ? 'lg:grid-cols-4 md:grid-cols-3' : 'md:grid-cols-3'} gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 lg:gap-x-8`}>
        {[1, 2, 3, 4, 5, 6].map((idx) => (
          <div key={idx} className="flex flex-col space-y-3">
            <div className="aspect-[3/4] bg-[#EFE9DC] animate-pulse rounded-xs" />
            <div className="h-3 bg-[#EFE9DC] animate-pulse w-1/3 rounded-xs" />
            <div className="h-4 bg-[#EFE9DC] animate-pulse w-4/5 rounded-xs" />
            <div className="h-4 bg-[#EFE9DC] animate-pulse w-1/4 rounded-xs" />
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="py-20 text-center bg-[#F4EFE6]/50 rounded-xs border border-[#1C1917]/10 p-8 my-8">
        <p className="font-serif text-xl text-[#1C1917] mb-1.5 font-normal">
          No textiles found matching your selection
        </p>
        <p className="text-xs text-[#78716C] max-w-md mx-auto">
          Please explore our broader handloom catalog or reset your filters to view all available weaves.
        </p>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 ${columns === 4 ? 'lg:grid-cols-4 md:grid-cols-3' : 'md:grid-cols-3'} gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 lg:gap-x-8`}>
      {products.map((product, idx) => (
        <ScrollReveal
          key={product.id}
          delay={(idx % (columns || 3)) * 80}
          duration={550}
          distance={16}
        >
          <ProductCard
            product={product}
            isWishlisted={wishlistIds.includes(product.id)}
            onToggleWishlist={onToggleWishlist}
            onSelectProduct={onSelectProduct}
            onQuickView={onQuickView}
            onAddToCart={onAddToCart}
          />
        </ScrollReveal>
      ))}
    </div>
  );
};
