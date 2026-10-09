import React, { useMemo } from 'react';
import { Container } from '../ui/Container';
import { ProductGrid } from '../catalog/ProductGrid';
import { Product, PageView } from '../../types';
import { PRODUCTS } from '../../data/catalog';

interface SalePageProps {
  onNavigate: (page: PageView) => void;
  wishlistIds: string[];
  onToggleWishlist: (product: Product) => void;
  onQuickView: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  products?: Product[];
}

export const SalePage: React.FC<SalePageProps> = ({
  onNavigate,
  wishlistIds,
  onToggleWishlist,
  onQuickView,
  onAddToCart,
  products = PRODUCTS,
}) => {
  const saleProducts = useMemo(() => {
    return products.filter((p) => p.onSale || (p.mrp && p.mrp > p.price));
  }, [products]);

  return (
    <div className="bg-[#FAF8F5] py-8 sm:py-12">
      <Container>
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-[#78716C] mb-8">
          <button
            onClick={() => onNavigate({ type: 'home' })}
            className="hover:text-[#1C1917] transition-colors cursor-pointer"
          >
            Home
          </button>
          <span>/</span>
          <span className="text-[#1C1917] font-medium">Seasonal Archive</span>
        </nav>

        {/* Editorial Sale Header */}
        <div className="border-b border-[#1C1917]/10 pb-8 mb-10 max-w-2xl">
          <span className="text-[11px] uppercase tracking-[0.2em] text-[#967029] font-medium block mb-2">
            Limited Batch Releases
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#1C1917] font-normal leading-tight">
            The Seasonal Archive
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[#57534E] leading-relaxed">
            Curated handloom weaves and archival bedding sets available with modest seasonal pricing. Each piece retains our uncompromising pure fabric standard.
          </p>
        </div>

        {/* Product Grid */}
        <ProductGrid
          products={saleProducts}
          wishlistIds={wishlistIds}
          columns={4}
          onToggleWishlist={onToggleWishlist}
          onSelectProduct={(slug) => onNavigate({ type: 'product', slug })}
          onQuickView={onQuickView}
          onAddToCart={onAddToCart}
        />
      </Container>
    </div>
  );
};
