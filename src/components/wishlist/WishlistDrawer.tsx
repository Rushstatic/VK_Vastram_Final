import React from 'react';
import { X, Trash2, Heart, ShoppingBag } from 'lucide-react';
import { Product } from '../../types';
import { PriceDisplay } from '../ui/PriceDisplay';
import { Button } from '../ui/Button';

interface WishlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onRemoveFromWishlist: (productId: string) => void;
  onAddToCart: (product: Product) => void;
  onQuickView: (product: Product) => void;
}

export const WishlistDrawer: React.FC<WishlistDrawerProps> = ({
  isOpen,
  onClose,
  products,
  onRemoveFromWishlist,
  onAddToCart,
  onQuickView,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="fixed inset-0 bg-[#1C1917]/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#FAF8F5] shadow-2xl flex flex-col border-l border-[#1C1917]/10">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#1C1917]/10 bg-[#FAF8F5]">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-[#78281F]" />
              <h3 className="font-serif text-xl font-normal text-[#1C1917]">
                Saved Creations
              </h3>
              <span className="text-xs text-[#78716C] tabular-nums">
                ({products.length})
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close saved items"
              className="p-1.5 text-[#57534E] hover:text-[#1C1917] rounded-sm transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {products.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-14 h-14 rounded-full bg-[#F4EFE6] flex items-center justify-center text-[#78716C] mb-4">
                  <Heart className="w-6 h-6" />
                </div>
                <h4 className="font-serif text-xl text-[#1C1917] mb-1 font-normal">
                  No saved creations yet
                </h4>
                <p className="text-xs text-[#78716C] max-w-xs mb-6 leading-relaxed">
                  Tap the heart icon on any saree or textile piece to save it to your personal shortlist.
                </p>
                <Button variant="primary" size="sm" onClick={onClose}>
                  Browse Textiles
                </Button>
              </div>
            ) : (
              products.map((product) => (
                <div
                  key={product.id}
                  className="flex gap-4 pb-5 border-b border-[#1C1917]/10 last:border-b-0"
                >
                  <img
                    src={product.primaryImage}
                    alt={product.name}
                    onClick={() => {
                      onQuickView(product);
                      onClose();
                    }}
                    className="w-20 h-24 object-cover rounded-xs bg-[#F4EFE6] shrink-0 cursor-pointer border border-[#1C1917]/5"
                  />
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4
                          onClick={() => {
                            onQuickView(product);
                            onClose();
                          }}
                          className="font-serif text-sm font-normal text-[#1C1917] line-clamp-2 leading-snug cursor-pointer hover:text-[#967029]"
                        >
                          {product.name}
                        </h4>
                        <button
                          type="button"
                          onClick={() => onRemoveFromWishlist(product.id)}
                          aria-label={`Remove ${product.name}`}
                          className="text-[#78716C] hover:text-[#78281F] transition-colors p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[11px] text-[#967029] mt-0.5 uppercase tracking-wider">
                        {product.categoryLabel}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <PriceDisplay price={product.price} mrp={product.mrp} size="sm" />
                      <button
                        type="button"
                        onClick={() => onAddToCart(product)}
                        className="py-1.5 px-3 bg-[#1C1917] hover:bg-[#2E2926] text-[#FAF8F5] text-xs rounded-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Move to Bag</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
