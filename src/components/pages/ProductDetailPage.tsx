import React, { useState, useEffect, useMemo } from 'react';
import { Container } from '../ui/Container';
import { Button } from '../ui/Button';
import { PriceDisplay } from '../ui/PriceDisplay';
import { Product, PageView, ProductVariant } from '../../types';
import { PRODUCTS } from '../../data/catalog';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import {
  Heart,
  ShoppingBag,
  ArrowLeft,
  ShieldCheck,
  Truck,
  RefreshCw,
  Check,
  Share2,
  AlertCircle,
  Package,
  Scissors,
  Sparkles,
} from 'lucide-react';
import { recentlyViewedService } from '../../services/recentlyViewedService';
import { getComplementaryProducts } from '../../lib/recommendations';
import { HorizontalProductRail } from '../catalog/HorizontalProductRail';
import { ProductReviewsSection } from '../catalog/ProductReviewsSection';
import { ColorSwatch } from '../ui/ColorSwatch';
import { ProductGallery } from '../product/ProductGallery';
import { formatVariantSku } from '../../lib/skuHelper';

interface ProductDetailPageProps {
  slug: string;
  products?: Product[];
  onNavigate: (page: PageView) => void;
  isWishlisted: boolean;
  onToggleWishlist: (product: Product) => void;
  onAddToCart: (product: Product, quantity: number, color?: string, size?: string) => void;
  onBuyNow: (product: Product, quantity: number, color?: string, size?: string) => void;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  slug,
  products = PRODUCTS,
  onNavigate,
  isWishlisted,
  onToggleWishlist,
  onAddToCart,
  onBuyNow,
}) => {
  const product = useMemo(() => {
    return products.find((p) => p.slug === slug) || PRODUCTS.find((p) => p.slug === slug);
  }, [products, slug]);

  const variants: ProductVariant[] = useMemo(() => {
    if (!product) return [];
    return product.variants && product.variants.length > 0
      ? product.variants
      : [
          {
            id: `${product.id}-default`,
            productId: product.id,
            sku: formatVariantSku(product.sku || 'VKV-SAR-001', 1),
            variantName: product.colors?.[0] || 'Standard Free Size',
            color: product.colors?.[0] || undefined,
            stockQuantity: product.stockQuantity ?? 10,
            availableQuantity: product.stockQuantity ?? 10,
            price: product.price,
            isActive: true,
            images: product.imagesWithRoles || [],
          },
        ];
  }, [product]);

  // Selected Variant state
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [addedAnimation, setAddedAnimation] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [activeDetailSection, setActiveDetailSection] = useState<'specs' | 'care' | 'shipping'>('specs');
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);

  // Optional Saree Services
  const [includeFallPico, setIncludeFallPico] = useState(false);
  const [includeGiftPackaging, setIncludeGiftPackaging] = useState(false);

  // Sync selected variant when variants or product change
  useEffect(() => {
    if (variants.length > 0) {
      // If current selectedVariantId is not in the new variants list, reset to first
      setSelectedVariantId((prev) => {
        const exists = variants.some((v) => v.id === prev);
        return exists ? prev : variants[0].id;
      });
    }
  }, [variants]);

  // Active Selected Variant object
  const currentVariant: ProductVariant = useMemo(() => {
    if (variants.length === 0) {
      return {
        id: 'fallback',
        productId: product?.id || '',
        sku: product?.sku || '',
        variantName: 'Standard',
        stockQuantity: product?.stockQuantity ?? 10,
        isActive: true,
      };
    }
    return variants.find((v) => v.id === selectedVariantId) || variants[0];
  }, [variants, selectedVariantId, product]);

  // Sync state when product slug changes
  useEffect(() => {
    if (product?.id) {
      if (variants.length > 0) {
        setSelectedVariantId(variants[0].id);
      }
      setSelectedSize(product.sizes && product.sizes.length > 0 ? product.sizes[0] : '');
      setQuantity(1);
      setIncludeFallPico(false);
      setIncludeGiftPackaging(false);

      // Record in Recently Viewed
      recentlyViewedService.recordView(product);
      setRecentlyViewed(recentlyViewedService.getRecentlyViewed(products, product.slug));
    }
  }, [product?.id, product?.slug, products]);

  // Handle color swatch click: select corresponding variant
  const handleColorSelect = (colorName: string) => {
    const matched = variants.find(
      (v) => v.color && v.color.toLowerCase() === colorName.toLowerCase()
    );
    if (matched) {
      setSelectedVariantId(matched.id);
    }
  };

  // Synchronized Pricing and Inventory
  const displayPrice = currentVariant.price ?? product?.price ?? 0;
  const displayMrp = currentVariant.mrpOverride ?? product?.mrp;
  const displaySku = currentVariant.sku || product?.sku;
  const availableStock = currentVariant.availableQuantity ?? currentVariant.stockQuantity ?? 10;
  const isSoldOut =
    product?.inStock === false ||
    currentVariant.isActive === false ||
    availableStock <= 0;

  // Variant-specific Images or fallback to product images (never leak other variants)
  const activeGalleryImages = useMemo(() => {
    if (!product) return [];

    if (currentVariant.images && currentVariant.images.length > 0) {
      return currentVariant.images;
    }

    if (product.imagesWithRoles && product.imagesWithRoles.length > 0) {
      // Exclude images assigned to other variants
      const variantFiltered = product.imagesWithRoles.filter((img) => {
        if (!img.variantId && !img.variantSku) return true;
        if (img.variantId && img.variantId === currentVariant.id) return true;
        if (img.variantSku && img.variantSku === currentVariant.sku) return true;
        return false;
      });

      if (variantFiltered.length > 0) {
        return variantFiltered;
      }
    }

    const list = [product.primaryImage, product.secondaryImage, ...(product.additionalImages || [])].filter(
      Boolean
    ) as string[];
    return Array.from(new Set(list));
  }, [currentVariant, product]);

  // If product is still loading, render neutral luxury placeholder instead of flashing an unrelated product
  if (!product) {
    return (
      <main className="py-12 bg-[#FAF8F5] min-h-[60vh]">
        <Container>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-14 animate-pulse">
            <div className="md:col-span-7 aspect-[3/4] bg-[#EFE8DA] rounded-xs" />
            <div className="md:col-span-5 space-y-4">
              <div className="h-4 bg-[#EFE8DA] rounded-xs w-1/3" />
              <div className="h-8 bg-[#EFE8DA] rounded-xs w-3/4" />
              <div className="h-6 bg-[#EFE8DA] rounded-xs w-1/4" />
              <div className="h-24 bg-[#EFE8DA] rounded-xs w-full mt-6" />
            </div>
          </div>
        </Container>
      </main>
    );
  }

  const handleAddToCart = () => {
    if (isSoldOut) return;
    onAddToCart(
      {
        ...product,
        price: displayPrice,
        sku: displaySku,
      },
      quantity,
      currentVariant.color,
      selectedSize
    );
    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 2000);
  };

  const handleBuyNow = () => {
    if (isSoldOut) return;
    onBuyNow(
      {
        ...product,
        price: displayPrice,
        sku: displaySku,
      },
      quantity,
      currentVariant.color,
      selectedSize
    );
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard?.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  const { settings } = useSiteSettings();
  const announcementText = settings?.announcementBarText || 'Complimentary Insured Delivery on Orders Above ₹1,999';
  const exchangeWindow = settings?.exchangeWindowDays || 7;

  // Algorithm-driven complementary creations (max 10)
  const complementaryProducts = getComplementaryProducts(product, products, 10);

  const isMeaninglessColor = (c?: string | null) => {
    if (!c || typeof c !== 'string') return true;
    const clean = c.trim().toLowerCase();
    return clean === '' || clean === 'null' || clean === 'undefined' || clean === '—' || clean === '-' || clean === 'n/a' || clean === 'none';
  };

  // Colors available across product variants
  const availableColors = useMemo(() => {
    const list = variants
      .map((v) => v.color)
      .filter((c): c is string => !isMeaninglessColor(c));
    return Array.from(new Set(list));
  }, [variants]);

  return (
    <div className="bg-[#FAF8F5] py-8 sm:py-12">
      <Container>
        {/* 1. Breadcrumbs Navigation */}
        <nav className="flex items-center gap-2 text-xs text-[#78716C] mb-6 overflow-x-auto whitespace-nowrap">
          <button
            onClick={() => onNavigate({ type: 'home' })}
            className="hover:text-[#1C1917] transition-colors cursor-pointer"
          >
            Home
          </button>
          <span>/</span>
          <button
            onClick={() => onNavigate({ type: 'collection', category: product.category })}
            className="hover:text-[#1C1917] transition-colors capitalize cursor-pointer"
          >
            {product.categoryLabel}
          </button>
          <span>/</span>
          <span className="text-[#1C1917] font-medium truncate max-w-xs">{product.name}</span>
        </nav>

        {/* Back Link */}
        <div className="mb-6">
          <button
            onClick={() => onNavigate({ type: 'collection', category: product.category })}
            className="inline-flex items-center gap-1.5 text-xs text-[#78716C] hover:text-[#1C1917] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to {product.categoryLabel}</span>
          </button>
        </div>

        {/* Main Product Layout (Gallery Left, Purchase Module Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start pb-16 border-b border-[#1C1917]/10">
          {/* Left Column: Intelligent Product Gallery with Magnifier & GSAP Variant Transitions */}
          <div className="lg:col-span-7">
            <ProductGallery
              images={activeGalleryImages}
              productName={product.name}
              isSoldOut={isSoldOut}
              onSale={product.onSale}
              tag={product.tag}
              variantKey={selectedVariantId}
            />
          </div>

          {/* Right Column: Refined Product Information Hierarchy */}
          <div className="lg:col-span-5 flex flex-col space-y-6 text-left">
            {/* 1. Eyebrow & Provenance Origin */}
            <div className="flex items-center justify-between text-xs text-[#78716C]">
              <span className="uppercase tracking-[0.2em] text-[#967029] font-semibold text-[11px]">
                {product.categoryLabel} {product.subCategory ? `· ${product.subCategory}` : ''}
              </span>
              <span className="font-serif italic text-sm text-[#78716C]">{product.origin}</span>
            </div>

            {/* 2. Product Title */}
            <div>
              <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#1C1917] font-normal leading-tight">
                {product.name}
              </h1>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-[#78716C]">
                <span className="font-mono text-[11px] text-[#A8A29E]">SKU: {displaySku}</span>
                <span>·</span>
                <span className="text-[#967029] font-medium flex items-center gap-1">
                  ★★★★★ <span className="text-[#78716C] text-[11px]">(Authentic Handloom)</span>
                </span>
              </div>
            </div>

            {/* 3. Pricing */}
            <div className="py-3 border-y border-[#1C1917]/10">
              <PriceDisplay
                price={displayPrice}
                mrp={displayMrp}
                size="lg"
                showSavings={true}
              />
              <p className="text-[11px] text-[#78716C] mt-1.5 font-light">
                Inclusive of all taxes · Complimentary insured delivery across India
              </p>
            </div>

            {/* 4. Editorial Narrative */}
            <p className="text-sm text-[#57534E] leading-relaxed font-normal">
              {product.description}
            </p>

            {/* 5. Authentic Highlights */}
            {product.highlights && product.highlights.length > 0 && (
              <div className="p-3 bg-[#F4EFE6]/60 border border-[#1C1917]/10 rounded-xs space-y-1.5">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#967029] block">
                  Artisanal Attributes
                </span>
                <ul className="space-y-1 text-xs text-[#57534E]">
                  {product.highlights.map((h, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-[#B88E3E]" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 6. Color / Variant Swatch Selector */}
            {availableColors.length > 0 ? (
              <div className="space-y-2.5 pt-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#78716C]">
                    Color Shade:{' '}
                    <span className="font-medium text-[#1C1917] capitalize">
                      {currentVariant.color && !isMeaninglessColor(currentVariant.color)
                        ? currentVariant.color
                        : 'Colour not configured'}
                    </span>
                  </span>
                  {availableColors.length > 0 && (
                    <span className="text-[11px] text-[#967029] font-medium">
                      {availableColors.length} Curated Tone{availableColors.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div role="radiogroup" aria-label="Available color shades" className="flex flex-wrap gap-2.5 items-center">
                  {availableColors.map((col) => {
                    const matchedVar = variants.find(
                      (v) => v.color && v.color.toLowerCase() === col.toLowerCase()
                    );
                    const isSelected =
                      currentVariant.color?.toLowerCase() === col.toLowerCase();
                    const varStock = matchedVar
                      ? matchedVar.availableQuantity ?? matchedVar.stockQuantity
                      : 10;
                    const isColorDisabled = varStock <= 0 || matchedVar?.isActive === false;

                    return (
                      <ColorSwatch
                        key={col}
                        colorName={col}
                        hexPrimary={matchedVar?.colorHexPrimary}
                        hexSecondary={matchedVar?.colorHexSecondary}
                        swatchImageUrl={matchedVar?.colorSwatchUrl}
                        size="md"
                        selected={isSelected}
                        disabled={isColorDisabled}
                        showLabel={true}
                        onClick={() => handleColorSelect(col)}
                      />
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#78716C]">
                    Color Shade:{' '}
                    <span className="font-normal text-[#78716C] italic">
                      Colour not configured
                    </span>
                  </span>
                </div>
              </div>
            )}

            {/* 6B. Multi-Variant Edition Selector (when product has multiple SKUs/editions) */}
            {variants.length > 1 && (
              <div className="space-y-2 pt-1 border-t border-[#1C1917]/10">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#78716C]">Select SKU / Edition:</span>
                  <span className="text-[11px] text-[#967029] font-mono font-medium">
                    {currentVariant.sku}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v) => {
                    const isSel = v.id === selectedVariantId;
                    const vStock = v.availableQuantity ?? v.stockQuantity;
                    const isSold = vStock <= 0 || v.isActive === false;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariantId(v.id)}
                        className={`text-xs px-3 py-1.5 rounded-xs border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSel
                            ? 'border-[#1C1917] bg-[#1C1917] text-[#FAF8F5] shadow-xs'
                            : isSold
                            ? 'border-[#1C1917]/15 bg-[#FAF8F5] text-[#A8A29E] line-through opacity-60'
                            : 'border-[#1C1917]/20 bg-[#FAF8F5] text-[#1C1917] hover:border-[#1C1917]'
                        }`}
                      >
                        <span>{v.variantName || v.sku}</span>
                        {v.priceOverride && (
                          <span className={isSel ? 'text-amber-200 font-mono text-[11px]' : 'text-[#967029] font-mono text-[11px]'}>
                            ₹{v.priceOverride.toLocaleString('en-IN')}
                          </span>
                        )}
                        {isSold && <span className="text-[10px] text-red-600 font-medium uppercase ml-1">Sold Out</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 7. Size / Dimension Selector (if applicable) */}
            {product.sizes && product.sizes.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#78716C]">Dimensions / Cut:</span>
                  <span className="font-medium text-[#1C1917]">{selectedSize}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={`text-xs px-3.5 py-2 rounded-xs border transition-colors cursor-pointer ${
                        selectedSize === size
                          ? 'border-[#1C1917] bg-[#1C1917] text-[#FAF8F5]'
                          : 'border-[#1C1917]/20 bg-[#FAF8F5] text-[#1C1917] hover:border-[#1C1917]'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 8. Optional Saree Services */}
            {product.category === 'sarees' && !isSoldOut && (
              <div className="p-3 bg-[#FAF8F5] border border-[#1C1917]/10 rounded-xs space-y-2.5">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#78716C] block">
                  Bespoke Finishing Services
                </span>
                <div className="space-y-2 text-xs">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="flex items-center gap-2 text-[#57534E] group-hover:text-[#1C1917]">
                      <Scissors className="w-3.5 h-3.5 text-[#967029]" />
                      <span>Complimentary Fall & Pico Edge Finishing</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={includeFallPico}
                      onChange={(e) => setIncludeFallPico(e.target.checked)}
                      className="accent-[#78281F] cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="flex items-center gap-2 text-[#57534E] group-hover:text-[#1C1917]">
                      <Package className="w-3.5 h-3.5 text-[#967029]" />
                      <span>Rigid Gold-Embossed Gift Box with Calligraphed Note</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={includeGiftPackaging}
                      onChange={(e) => setIncludeGiftPackaging(e.target.checked)}
                      className="accent-[#78281F] cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* 9. Authoritative Inventory Indicator */}
            <div className="text-xs">
              {isSoldOut ? (
                <div className="flex items-center gap-1.5 text-red-700 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Currently out of stock. Please explore our complementary drapes below.</span>
                </div>
              ) : availableStock === 1 ? (
                <div className="flex items-center gap-1.5 text-[#78281F] font-semibold animate-pulse">
                  <Sparkles className="w-3.5 h-3.5 text-[#967029]" />
                  <span>Only 1 drape remaining — Single artisanal piece</span>
                </div>
              ) : availableStock <= 5 ? (
                <div className="flex items-center gap-1.5 text-[#967029] font-medium">
                  <span>Only {availableStock} drapes remaining in this colorway</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>In Stock · Ready to dispatch from our Pune weaving house</span>
                </div>
              )}
            </div>

            {/* 10. Purchase Actions */}
            <div className="space-y-3 pt-1">
              {isSoldOut ? (
                <Button
                  variant="primary"
                  fullWidth
                  size="lg"
                  disabled
                  className="font-semibold tracking-wide uppercase opacity-60 cursor-not-allowed"
                >
                  SOLD OUT
                </Button>
              ) : (
                <>
                  {/* Primary CTA: BUY NOW */}
                  <Button
                    variant="primary"
                    fullWidth
                    size="lg"
                    onClick={handleBuyNow}
                    className="font-semibold tracking-wide uppercase shadow-xs hover:shadow-sm"
                  >
                    BUY NOW
                  </Button>

                  {/* Secondary Action Row: Quantity + Add to Bag + Wishlist + Share */}
                  <div className="flex items-center gap-3">
                    {/* Quantity */}
                    <div className="flex items-center border border-[#1C1917]/20 rounded-xs bg-[#FAF8F5]">
                      <button
                        type="button"
                        onClick={() => setQuantity((prev) => Math.max(1, (Number(prev) || 1) - 1))}
                        className="px-3.5 py-2.5 text-sm text-[#1C1917] hover:bg-[#F4EFE6] cursor-pointer"
                        title="Decrease quantity"
                      >
                        -
                      </button>
                      <span className="px-3.5 py-2.5 text-xs font-semibold tabular-nums min-w-[32px] text-center">
                        {Number(quantity) || 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity((prev) => Math.min(availableStock, (Number(prev) || 1) + 1))}
                        className="px-3.5 py-2.5 text-sm text-[#1C1917] hover:bg-[#F4EFE6] cursor-pointer"
                        title="Increase quantity"
                      >
                        +
                      </button>
                    </div>

                    {/* Add to Bag */}
                    <Button
                      variant="outline"
                      fullWidth
                      size="md"
                      onClick={handleAddToCart}
                      leftIcon={
                        addedAnimation ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <ShoppingBag className="w-4 h-4" />
                        )
                      }
                    >
                      {addedAnimation ? 'Added to Bag' : `Add ${quantity > 1 ? `(${quantity}) ` : ''}to Bag`}
                    </Button>

                    {/* Wishlist */}
                    <button
                      type="button"
                      onClick={() => onToggleWishlist(product)}
                      aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                      className={`p-3 border rounded-xs transition-colors cursor-pointer ${
                        isWishlisted
                          ? 'border-[#78281F] text-[#78281F] bg-[#78281F]/5'
                          : 'border-[#1C1917]/20 text-[#1C1917] hover:border-[#1C1917]'
                      }`}
                      title={isWishlisted ? 'Saved in Wishlist' : 'Save to Wishlist'}
                    >
                      <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-[#78281F]' : ''}`} />
                    </button>

                    {/* Share */}
                    <button
                      type="button"
                      onClick={handleShare}
                      aria-label="Share creation"
                      className="p-3 border border-[#1C1917]/20 text-[#1C1917] hover:border-[#1C1917] rounded-xs transition-colors cursor-pointer"
                      title={shareCopied ? 'Link Copied!' : 'Copy Link'}
                    >
                      {shareCopied ? <Check className="w-5 h-5 text-emerald-600" /> : <Share2 className="w-5 h-5" />}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* 11. Dispatch Timeline Information */}
            <div className="p-3 bg-[#FAF8F5] rounded-xs border border-[#1C1917]/10 flex items-center gap-3 text-xs text-[#57534E]">
              <Truck className="w-4 h-4 text-[#967029] shrink-0" />
              <span>
                <strong>Dispatches within 24–48 business hours</strong> · Insured express transit across India.
              </span>
            </div>

            {/* 12. Trust Assurances */}
            <div className="grid grid-cols-3 gap-3 pt-2 text-center">
              <div className="p-2.5 bg-[#FAF8F5] rounded-xs border border-[#1C1917]/10 flex flex-col items-center">
                <ShieldCheck className="w-4 h-4 text-[#967029] mb-1" />
                <span className="text-[10px] font-medium text-[#1C1917]">100% Authentic Handloom</span>
              </div>
              <div className="p-2.5 bg-[#FAF8F5] rounded-xs border border-[#1C1917]/10 flex flex-col items-center">
                <Truck className="w-4 h-4 text-[#967029] mb-1" />
                <span className="text-[10px] font-medium text-[#1C1917]">Insured Transit</span>
              </div>
              <div className="p-2.5 bg-[#FAF8F5] rounded-xs border border-[#1C1917]/10 flex flex-col items-center">
                <RefreshCw className="w-4 h-4 text-[#967029] mb-1" />
                <span className="text-[10px] font-medium text-[#1C1917]">{exchangeWindow}-Day Exchange</span>
              </div>
            </div>

            {/* 13. Editorial Tabs (Specifications, Care, Shipping) */}
            <div className="border-t border-[#1C1917]/10 pt-4">
              <div className="flex items-center gap-6 border-b border-[#1C1917]/10 pb-2 mb-4 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setActiveDetailSection('specs')}
                  className={`font-serif text-base pb-1 relative cursor-pointer ${
                    activeDetailSection === 'specs'
                      ? 'text-[#1C1917] font-semibold'
                      : 'text-[#78716C] hover:text-[#1C1917]'
                  }`}
                >
                  Specifications & Provenance
                  {activeDetailSection === 'specs' && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#B88E3E]" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDetailSection('care')}
                  className={`font-serif text-base pb-1 relative cursor-pointer ${
                    activeDetailSection === 'care'
                      ? 'text-[#1C1917] font-semibold'
                      : 'text-[#78716C] hover:text-[#1C1917]'
                  }`}
                >
                  Fabric Care & Longevity
                  {activeDetailSection === 'care' && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#B88E3E]" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDetailSection('shipping')}
                  className={`font-serif text-base pb-1 relative cursor-pointer ${
                    activeDetailSection === 'shipping'
                      ? 'text-[#1C1917] font-semibold'
                      : 'text-[#78716C] hover:text-[#1C1917]'
                  }`}
                >
                  Shipping & Returns
                  {activeDetailSection === 'shipping' && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#B88E3E]" />
                  )}
                </button>
              </div>

              {activeDetailSection === 'specs' && (
                <div className="space-y-3 text-xs sm:text-sm text-[#57534E]">
                  {product.fabric && (
                    <div className="grid grid-cols-3 py-2 border-b border-[#1C1917]/5">
                      <span className="text-[#78716C]">Fabric</span>
                      <span className="col-span-2 font-medium text-[#1C1917]">{product.fabric}</span>
                    </div>
                  )}
                  {product.weave && (
                    <div className="grid grid-cols-3 py-2 border-b border-[#1C1917]/5">
                      <span className="text-[#78716C]">Weaving Technique</span>
                      <span className="col-span-2 font-medium text-[#1C1917]">{product.weave}</span>
                    </div>
                  )}
                  {product.origin && (
                    <div className="grid grid-cols-3 py-2 border-b border-[#1C1917]/5">
                      <span className="text-[#78716C]">Provenance</span>
                      <span className="col-span-2 font-medium text-[#1C1917]">{product.origin}</span>
                    </div>
                  )}
                  {product.dimensions && (
                    <div className="grid grid-cols-3 py-2 border-b border-[#1C1917]/5">
                      <span className="text-[#78716C]">Dimensions</span>
                      <span className="col-span-2 font-medium text-[#1C1917]">{product.dimensions}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-3 py-2 border-b border-[#1C1917]/5">
                    <span className="text-[#78716C]">Authenticity</span>
                    <span className="col-span-2 font-medium text-[#1C1917]">
                      Hand-inspected for thread integrity and pure zari brilliance
                    </span>
                  </div>
                </div>
              )}

              {activeDetailSection === 'care' && (
                <div className="text-xs sm:text-sm text-[#57534E] leading-relaxed space-y-3">
                  <p>{product.care || 'Dry clean only. Air out occasionally in shade.'}</p>
                  <div className="p-4 bg-[#F4EFE6] rounded-xs border border-[#1C1917]/10 text-xs text-[#57534E]">
                    <p className="font-semibold text-[#1C1917] mb-1">Preservation Recommendation</p>
                    <p>
                      Store in a cool, dry place wrapped in breathable unbleached cotton or muslin cloth.
                      Refold periodically along different crease lines to preserve zari thread strength.
                    </p>
                  </div>
                </div>
              )}

              {activeDetailSection === 'shipping' && (
                <div className="text-xs sm:text-sm text-[#57534E] leading-relaxed space-y-3">
                  <p>{announcementText}</p>
                  <p>
                    Insured nationwide dispatch within 24–48 business hours via premium courier partners.
                    Exchanges honored within {exchangeWindow} days of delivery for creations in original unworn
                    condition with security tags intact.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 14. Complementary Creations Horizontal Rail */}
        {complementaryProducts.length > 0 && (
          <HorizontalProductRail
            title="Complementary Creations"
            actionText="View Collection →"
            onActionClick={() => onNavigate({ type: 'collection', category: product.category })}
            products={complementaryProducts}
            onSelectProduct={(targetSlug) => onNavigate({ type: 'product', slug: targetSlug })}
            onToggleWishlist={onToggleWishlist}
            onAddToCart={(p) => onAddToCart(p, 1)}
          />
        )}

        {/* 15. Customer Reviews Section */}
        <ProductReviewsSection
          productId={product.id}
          productName={product.name}
        />

        {/* 16. Recently Viewed Products Rail */}
        {recentlyViewed.length > 0 && (
          <HorizontalProductRail
            title="Recently Viewed"
            products={recentlyViewed}
            onSelectProduct={(targetSlug) => onNavigate({ type: 'product', slug: targetSlug })}
            onToggleWishlist={onToggleWishlist}
            onAddToCart={(p) => onAddToCart(p, 1)}
            className="border-t border-[#1C1917]/10"
          />
        )}
      </Container>
    </div>
  );
};
