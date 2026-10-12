import React, { useState } from 'react';
import { Heart, ShoppingBag, Eye, Check } from 'lucide-react';
import { Product } from '../../types';
import { PriceDisplay } from '../ui/PriceDisplay';
import { ImageContainer } from '../ui/ImageContainer';
import { ColorSwatch } from '../ui/ColorSwatch';

interface ProductCardProps {
  product: Product;
  isWishlisted?: boolean;
  onToggleWishlist?: (product: Product) => void;
  onSelectProduct?: (slug: string) => void;
  onQuickView?: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isWishlisted = false,
  onToggleWishlist,
  onSelectProduct,
  onQuickView,
  onAddToCart,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);

  const colors = product.colors && product.colors.length > 0 ? product.colors : [];
  const selectedColor = colors[selectedColorIndex];

  // Match selected variant
  const activeVariant = React.useMemo(() => {
    if (!product.variants || product.variants.length === 0) {
      return null;
    }
    if (!selectedColor) {
      return product.variants[0] || null;
    }
    return (
      product.variants.find(
        (v) => v.color && v.color.toLowerCase() === selectedColor.toLowerCase()
      ) || product.variants[0] || null
    );
  }, [product.variants, selectedColor]);

  const handleCardClick = () => {
    if (onSelectProduct) {
      onSelectProduct(product.slug);
    }
  };

  const activeStock = activeVariant
    ? (activeVariant.availableQuantity ?? activeVariant.stockQuantity)
    : (product.stockQuantity ?? 0);

  const isSoldOut =
    (!activeVariant && product.inStock === false) ||
    (activeVariant ? activeVariant.isActive === false : false) ||
    activeStock <= 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSoldOut) {
      return;
    }
    if (onAddToCart) {
      onAddToCart(
        activeVariant
          ? {
              ...product,
              price: activeVariant.price ?? product.price,
              sku: activeVariant.sku || product.sku,
            }
          : product
      );
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1800);
    }
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleWishlist) {
      onToggleWishlist(product);
    }
  };

  const handleQuickViewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onQuickView) {
      onQuickView(product);
    }
  };

  // Variant-specific image if selected, otherwise hover or primary image
  const variantImage = activeVariant?.images?.[0]?.imageUrl;
  const displayImage =
    variantImage ||
    (isHovered && product.secondaryImage
      ? product.secondaryImage
      : product.primaryImage);

  const displayPrice = activeVariant?.price ?? product.price;
  const displayMrp = activeVariant?.mrpOverride ?? product.mrp;

  return (
    <div
      className="group relative flex flex-col bg-transparent text-left cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      {/* Product Image Stage (3:4 ratio) */}
      <div className="relative overflow-hidden bg-[#F4EFE6] rounded-xs transition-all duration-300">
        <ImageContainer
          src={displayImage}
          alt={product.name}
          aspectRatio="3/4"
          imageClassName="transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />

        {/* Minimal Text Tag / Kicker on Image */}
        {isSoldOut ? (
          <div className="absolute top-3 left-3 z-10">
            <span className="inline-block bg-[#1C1917]/90 backdrop-blur-xs text-[#FAF8F5] text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 border border-white/10">
              Sold Out
            </span>
          </div>
        ) : product.onSale ? (
          <div className="absolute top-3 left-3 z-10">
            <span className="inline-block bg-[#78281F] text-[#FAF8F5] text-[10px] uppercase tracking-wider font-medium px-2 py-0.5">
              Sale
            </span>
          </div>
        ) : product.tag ? (
          <div className="absolute top-3 left-3 z-10">
            <span className="inline-block bg-[#FAF8F5]/90 backdrop-blur-xs text-[#1C1917] border border-[#1C1917]/10 text-[10px] uppercase tracking-wider font-medium px-2 py-0.5">
              {product.tag}
            </span>
          </div>
        ) : null}

        {/* Wishlist Button */}
        <button
          type="button"
          onClick={handleToggleWishlist}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-90 ${
            isWishlisted
              ? 'bg-[#FAF8F5] text-[#78281F] shadow-xs'
              : 'bg-[#FAF8F5]/80 text-[#1C1917] hover:bg-[#FAF8F5] hover:text-[#78281F]'
          }`}
        >
          <Heart
            className={`w-3.5 h-3.5 transition-transform duration-200 ${isWishlisted ? 'fill-[#78281F] scale-110' : 'scale-100'}`}
          />
        </button>

        {/* Subtle Hover Action Bar */}
        <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-[#1C1917]/75 via-[#1C1917]/30 to-transparent opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 flex items-center gap-1.5 z-10">
          {isSoldOut ? (
            <div className="flex-1 py-2 px-3 text-[11px] font-medium rounded-xs bg-[#1C1917]/80 text-[#FAF8F5]/80 text-center tracking-wide uppercase">
              Sold Out
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAddToCart}
              className={`flex-1 py-2 px-3 text-xs font-medium rounded-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] ${
                justAdded
                  ? 'bg-[#1F382B] text-[#FAF8F5]'
                  : 'bg-[#FAF8F5] text-[#1C1917] hover:bg-[#FFFFFF]'
              }`}
            >
              {justAdded ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Added</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Add to Bag</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleQuickViewClick}
            aria-label="Quick preview"
            className="p-2 bg-[#FAF8F5]/90 hover:bg-[#FAF8F5] text-[#1C1917] rounded-xs transition-all cursor-pointer active:scale-95"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Product Metadata */}
      <div className="pt-3 pb-1 flex flex-col flex-1">
        {/* Category & Origin Line */}
        <div className="flex items-center justify-between text-xs text-[#78716C] mb-1">
          <span className="uppercase tracking-wider text-[10px] font-medium text-[#967029]">
            {product.categoryLabel}
          </span>
          <span className="text-[11px] text-[#A8A29E] font-serif italic truncate max-w-[120px]">
            {product.origin?.split(',')[0]}
          </span>
        </div>

        {/* Product Title */}
        <h3 className="font-serif text-sm sm:text-base font-normal text-[#1C1917] group-hover:text-[#967029] transition-colors leading-snug line-clamp-1 mb-1.5">
          {product.name}
        </h3>

        {/* Color Swatch Preview (if available) */}
        {product.colors && product.colors.length > 0 && (
          <div
            className="flex items-center gap-1.5 mb-2 py-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            {product.colors.slice(0, 4).map((col, cIdx) => {
              const matchedVar = product.variants?.find(
                (v) => v.color && v.color.toLowerCase() === col.toLowerCase()
              );
              const isColSoldOut = matchedVar
                ? (matchedVar.availableQuantity ?? matchedVar.stockQuantity) <= 0 || matchedVar.isActive === false
                : false;

              return (
                <ColorSwatch
                  key={col}
                  colorName={col}
                  hexPrimary={matchedVar?.colorHexPrimary}
                  hexSecondary={matchedVar?.colorHexSecondary}
                  swatchImageUrl={matchedVar?.colorSwatchUrl}
                  size="sm"
                  selected={selectedColorIndex === cIdx}
                  disabled={isColSoldOut}
                  onClick={() => setSelectedColorIndex(cIdx)}
                />
              );
            })}
            {product.colors.length > 4 && (
              <span className="text-[10px] text-[#78716C] font-mono">
                +{product.colors.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Price Row */}
        <div className="mt-auto pt-1">
          <PriceDisplay price={displayPrice} mrp={displayMrp} size="sm" />
        </div>
      </div>
    </div>
  );
};
