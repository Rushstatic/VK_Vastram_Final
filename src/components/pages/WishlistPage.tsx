import React from 'react';
import { Container } from '../ui/Container';
import { ProductCard } from '../catalog/ProductCard';
import { Product, PageView } from '../../types';
import { Heart } from 'lucide-react';
import { Button } from '../ui/Button';

interface WishlistPageProps {
  products: Product[];
  onNavigate: (page: PageView) => void;
  onRemoveFromWishlist: (productId: string) => void;
  onQuickView: (product: Product) => void;
  onAddToCart: (product: Product, quantity?: number, color?: string, size?: string, variantId?: string) => void;
}

export const WishlistPage: React.FC<WishlistPageProps> = ({
  products,
  onNavigate,
  onRemoveFromWishlist,
  onQuickView,
  onAddToCart,
}) => {
  return (
    <div className="bg-[#FAF8F5] py-8 sm:py-12 min-h-[60vh]">
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
          <span className="text-[#1C1917] font-medium">Saved Creations</span>
        </nav>

        {/* Header */}
        <div className="border-b border-[#1C1917]/10 pb-8 mb-8">
          <span className="text-[11px] uppercase tracking-[0.2em] text-[#967029] font-medium block mb-2">
            Personal Shortlist
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#1C1917] font-normal leading-tight">
            Saved Creations
          </h1>
          <p className="mt-2 text-sm text-[#57534E]">
            Review your shortlisted sarees, bedding ensembles, and artisanal textiles.
          </p>
        </div>

        {/* Content */}
        {products.length === 0 ? (
          <div className="py-20 text-center bg-[#F4EFE6]/50 rounded-xs border border-[#1C1917]/10 p-8 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-[#FAF8F5] border border-[#1C1917]/10 flex items-center justify-center text-[#78716C] mx-auto mb-4">
              <Heart className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-2xl text-[#1C1917] font-normal mb-2">
              Your wishlist is currently empty
            </h3>
            <p className="text-xs text-[#57534E] mb-6 leading-relaxed">
              Explore our handloom collections and tap the heart icon to curate your personal favorites.
            </p>
            <Button
              variant="primary"
              size="md"
              onClick={() => onNavigate({ type: 'collection', category: 'sarees' })}
            >
              Explore Sarees
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isWishlisted={true}
                onToggleWishlist={() => onRemoveFromWishlist(product.id)}
                onSelectProduct={(slug) => onNavigate({ type: 'product', slug })}
                onQuickView={onQuickView}
                onAddToCart={onAddToCart}
              />
            ))}
          </div>
        )}
      </Container>
    </div>
  );
};
