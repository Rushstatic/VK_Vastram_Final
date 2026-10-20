import React, { useState } from 'react';
import { X, Heart, ShoppingBag, ShieldCheck, Truck, RefreshCw, Check } from 'lucide-react';
import { Product } from '../../types';
import { PriceDisplay } from '../ui/PriceDisplay';
import { ImageContainer } from '../ui/ImageContainer';
import { Button } from '../ui/Button';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { ColorSwatch } from '../ui/ColorSwatch';
import { MobileImageViewer } from '../product/MobileImageViewer';
import { normalizeImageUrl } from '../../lib/imageHelper';

interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  isWishlisted?: boolean;
  onToggleWishlist?: (product: Product) => void;
  onAddToCart?: (product: Product, quantity: number, color?: string, size?: string, variantId?: string, includeFallPico?: boolean) => void | boolean | Promise<void | boolean>;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  isOpen,
  onClose,
  isWishlisted = false,
  onToggleWishlist,
  onAddToCart,
}) => {
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'details' | 'care' | 'shipping'>('details');
  const [addedAnimation, setAddedAnimation] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);

  // Sync color/size on product change
  React.useEffect(() => {
    if (product) {
      setSelectedColor(product.colors && product.colors.length > 0 ? product.colors[0] : '');
      setSelectedSize(product.sizes && product.sizes.length > 0 ? product.sizes[0] : '');
      setSelectedImage('');
      setIsImageViewerOpen(false);
      setQuantity(1);
    }
  }, [product?.id]);

  // Hooks remain unconditional while the modal is closed/open to avoid a hook-order crash.
  const activeVariant = React.useMemo(() => {
    const variants = product?.variants || [];
    if (variants.length === 0) return null;
    if (!selectedColor) return variants[0] || null;
    return variants.find(
      (v) => v.color && v.color.toLowerCase() === selectedColor.toLowerCase()
    ) || variants[0] || null;
  }, [product?.variants, selectedColor]);

  // Reset selected image when changing color/variant to prevent cross-variant thumbnail stickiness.
  React.useEffect(() => {
    setSelectedImage('');
  }, [selectedColor, activeVariant?.id]);

  React.useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [isOpen]);

  const { settings } = useSiteSettings();
  const announcementText = settings?.announcementBarText || 'Shipping charges calculated at checkout.';
  const exchangeWindow = settings?.exchangeWindowDays || 7;

  if (!isOpen || !product) return null;

  const displayPrice = activeVariant?.price ?? product.price;
  const displayMrp = activeVariant?.mrpOverride ?? product.mrp;
  const displaySku = activeVariant?.sku || product.sku;
  const availableStock = activeVariant?.availableQuantity ?? activeVariant?.stockQuantity ?? product.stockQuantity ?? 0;

  const isSoldOut =
    (activeVariant && activeVariant.isActive === false) ||
    availableStock <= 0;

  const variantImages = (activeVariant?.images || [])
    .map((image) => image.imageUrl)
    .filter((url): url is string => typeof url === 'string' && Boolean(url.trim()));
  const generalRoleImages = (product.imagesWithRoles || [])
    .filter((image) => !image.variantId && !image.variantSku)
    .sort((a, b) => {
      if (Boolean(a.isPrimary) !== Boolean(b.isPrimary)) return a.isPrimary ? -1 : 1;
      return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
    })
    .map((image) => image.imageUrl)
    .filter((url): url is string => typeof url === 'string' && Boolean(url.trim()));
  const hasVariantScopedImages = Boolean(
    product.imagesWithRoles?.some((image) => image.variantId || image.variantSku) ||
    product.variants?.some((variant) => (variant.images || []).some((image) => image.variantId || image.variantSku))
  );
  const legacyProductImages = [product.primaryImage, product.secondaryImage, ...(product.additionalImages || [])]
    .filter((url): url is string => typeof url === 'string' && Boolean(url.trim()));
  const productImages = generalRoleImages.length > 0
    ? generalRoleImages
    : (hasVariantScopedImages ? [] : legacyProductImages);
  // Only use true product-level images as a fallback. A variant with no gallery
  // must not inherit the first image of another color.
  const images = variantImages.length > 0 ? variantImages : productImages;
  const currentImage = (selectedImage && images.includes(selectedImage) ? selectedImage : '') || images[0] || '';
  const currentImageFallback = activeVariant?.images?.find((image) => normalizeImageUrl(image.imageUrl) === normalizeImageUrl(currentImage))?.fallbackImageUrl ||
    product.imagesWithRoles?.find((image) =>
      normalizeImageUrl(image.imageUrl) === normalizeImageUrl(currentImage) &&
      (!image.variantId || image.variantId === activeVariant?.id) &&
      (!image.variantSku || image.variantSku === activeVariant?.sku)
    )?.fallbackImageUrl;

  const handleAddToCart = async () => {
    if (isSoldOut || !onAddToCart) return;
    try {
      const result = await onAddToCart(
        { ...product, price: displayPrice, sku: displaySku },
        quantity,
        selectedColor,
        selectedSize,
        activeVariant?.id,
        false
      );
      if (result === false) return;
      setAddedAnimation(true);
      window.setTimeout(() => setAddedAnimation(false), 2000);
    } catch (error) {
      console.warn('Could not add item from quick view:', error);
    }
  };

  const currentImageIndex = Math.max(0, images.findIndex((image) => normalizeImageUrl(image) === normalizeImageUrl(currentImage)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden overscroll-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#1C1917]/65 backdrop-blur-xs transition-opacity vk-product-modal-backdrop"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-4xl bg-[#FAF8F5] shadow-2xl rounded-sm border border-[#1C1917]/10 z-10 overflow-y-auto overscroll-contain my-auto max-h-[92dvh] flex flex-col md:flex-row vk-product-modal-panel">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close product view"
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-[#FAF8F5]/90 text-[#1C1917] hover:bg-[#FAF8F5] flex items-center justify-center shadow-xs cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left Column: Image Gallery */}
        <div className="w-full md:w-1/2 p-4 sm:p-6 bg-[#F4EFE6]/60 flex flex-col justify-between">
          <div className="relative overflow-hidden rounded-sm bg-[#FAF8F5] border border-[#1C1917]/5 shadow-xs">
            <button
              type="button"
              onClick={() => setIsImageViewerOpen(true)}
              aria-label={`Open full-screen gallery for ${product.name}`}
              className="block w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#B88E3E]"
            >
              <ImageContainer
                src={currentImage}
                fallbackSrc={currentImageFallback}
                alt={product.name}
                aspectRatio="3/4"
                priority
                className="w-full"
              />
            </button>
            {product.tag && (
              <span className="absolute top-3 left-3 bg-[#FAF8F5]/95 text-[#1C1917] border border-[#1C1917]/10 text-[10px] font-medium uppercase tracking-wider px-2.5 py-1">
                {product.tag}
              </span>
            )}
          </div>

          {/* Thumbnail Strip */}
          {images.length > 1 && (
            <div className="flex max-w-full gap-2.5 mt-4 overflow-x-auto pb-1">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(img)}
                  className={`w-16 h-20 shrink-0 rounded-xs overflow-hidden border-2 cursor-pointer transition-all ${
                    currentImage === img
                      ? 'border-[#B88E3E] opacity-100'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={normalizeImageUrl(img)}
                    alt={`${product.name} angle ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Information & Purchase Module */}
        <div className="w-full md:w-1/2 p-4 sm:p-8 flex flex-col md:overflow-y-auto md:max-h-[90dvh] overscroll-contain">
          {/* Category & Origin */}
          <div className="flex items-center justify-between text-xs text-[#78716C] mb-2">
            <span className="uppercase tracking-widest text-[#967029] font-medium">
              {product.categoryLabel}
            </span>
            <span className="font-serif italic text-sm">{product.origin}</span>
          </div>

          {/* Product Title */}
          <h2 className="font-serif text-2xl sm:text-3xl text-[#1C1917] font-normal leading-snug">
            {product.name}
          </h2>

          {/* Pricing */}
          <div className="my-4 pb-4 border-b border-[#1C1917]/10">
            <PriceDisplay
              price={displayPrice}
              mrp={displayMrp}
              size="lg"
              showSavings={true}
            />
            <p className="text-[11px] text-[#78716C] mt-1">
              Inclusive of all taxes · {announcementText}
            </p>
          </div>

          {/* Short Description */}
          <p className="text-sm text-[#57534E] leading-relaxed mb-4 font-normal">
            {product.description}
          </p>

          {/* Color Selection */}
          {product.colors && product.colors.length > 0 ? (
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-xs">
                <span className="text-[#78716C]">Color Shade:</span>
                <span className="font-medium text-[#1C1917] capitalize">{selectedColor || 'Colour not configured'}</span>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {product.colors.map((color) => {
                  const matched = product.variants?.find(
                    (v) => v.color && v.color.toLowerCase() === color.toLowerCase()
                  );
                  const isColorSoldOut = matched
                    ? (matched.availableQuantity ?? matched.stockQuantity) <= 0 || matched.isActive === false
                    : false;

                  return (
                    <ColorSwatch
                      key={color}
                      colorName={color}
                      hexPrimary={matched?.colorHexPrimary}
                      hexSecondary={matched?.colorHexSecondary}
                      swatchImageUrl={matched?.colorSwatchUrl}
                      size="md"
                      selected={selectedColor === color}
                      disabled={isColorSoldOut}
                      showLabel={true}
                      onClick={() => setSelectedColor(color)}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-1 mb-4">
              <div className="flex justify-between text-xs">
                <span className="text-[#78716C]">Color Shade:</span>
                <span className="font-normal text-[#78716C] italic">Colour not configured</span>
              </div>
            </div>
          )}

          {/* Quantity & CTA Module */}
          <div className="space-y-3 mb-6">
            {isSoldOut ? (
              <div className="p-3 bg-[#F4EFE6] border border-[#1C1917]/15 rounded-xs text-xs text-[#57534E] text-center font-medium">
                This creation is currently sold out.
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {/* Quantity Selector */}
                <div className="flex items-center border border-[#1C1917]/20 rounded-sm bg-[#FAF8F5]">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-2.5 text-sm text-[#1C1917] hover:bg-[#F4EFE6] cursor-pointer"
                  >
                    -
                  </button>
                  <span className="px-3 py-2.5 text-xs font-semibold tabular-nums min-w-[32px] text-center">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3 py-2.5 text-sm text-[#1C1917] hover:bg-[#F4EFE6] cursor-pointer"
                  >
                    +
                  </button>
                </div>

                {/* Add to Bag Button */}
                <Button
                  variant="primary"
                  fullWidth
                  size="md"
                  onClick={handleAddToCart}
                  leftIcon={addedAnimation ? <Check className="w-4 h-4 text-emerald-400" /> : <ShoppingBag className="w-4 h-4" />}
                >
                  {addedAnimation ? 'Added to Bag' : `Add ${quantity > 1 ? `(${quantity}) ` : ''}to Bag`}
                </Button>

                {/* Wishlist Button */}
                <button
                  type="button"
                  onClick={() => onToggleWishlist && onToggleWishlist(product)}
                  aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                  className={`p-3 border rounded-sm transition-colors cursor-pointer ${
                    isWishlisted
                      ? 'border-[#78281F] text-[#78281F] bg-[#78281F]/5'
                      : 'border-[#1C1917]/20 text-[#1C1917] hover:border-[#1C1917]'
                  }`}
                >
                  <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-[#78281F]' : ''}`} />
                </button>
              </div>
            )}
          </div>

          {/* Interactive Specification Tabs */}
          <div className="border-t border-[#1C1917]/10 pt-4 flex-1">
            <div className="flex items-center gap-6 border-b border-[#1C1917]/10 pb-2 mb-4 text-xs font-medium">
              <button
                onClick={() => setActiveTab('details')}
                className={`pb-2 transition-colors relative cursor-pointer ${
                  activeTab === 'details'
                    ? 'text-[#1C1917] font-semibold'
                    : 'text-[#78716C] hover:text-[#1C1917]'
                }`}
              >
                Fabric & Specs
                {activeTab === 'details' && (
                  <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#B88E3E]" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('care')}
                className={`pb-2 transition-colors relative cursor-pointer ${
                  activeTab === 'care'
                    ? 'text-[#1C1917] font-semibold'
                    : 'text-[#78716C] hover:text-[#1C1917]'
                }`}
              >
                Care & Longevity
                {activeTab === 'care' && (
                  <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#B88E3E]" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('shipping')}
                className={`pb-2 transition-colors relative cursor-pointer ${
                  activeTab === 'shipping'
                    ? 'text-[#1C1917] font-semibold'
                    : 'text-[#78716C] hover:text-[#1C1917]'
                }`}
              >
                Shipping & Delivery
                {activeTab === 'shipping' && (
                  <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#B88E3E]" />
                )}
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'details' && (
              <div className="space-y-2 text-xs text-[#57534E]">
                {product.fabric && (
                  <div className="flex justify-between py-1 border-b border-[#1C1917]/5">
                    <span className="text-[#78716C]">Fabric Composition</span>
                    <span className="font-medium text-[#1C1917]">{product.fabric}</span>
                  </div>
                )}
                {product.weave && (
                  <div className="flex justify-between py-1 border-b border-[#1C1917]/5">
                    <span className="text-[#78716C]">Weave Technique</span>
                    <span className="font-medium text-[#1C1917]">{product.weave}</span>
                  </div>
                )}
                {product.origin && (
                  <div className="flex justify-between py-1 border-b border-[#1C1917]/5">
                    <span className="text-[#78716C]">Weaving Origin</span>
                    <span className="font-medium text-[#1C1917]">{product.origin}</span>
                  </div>
                )}
                {product.dimensions && (
                  <div className="flex justify-between py-1">
                    <span className="text-[#78716C]">Dimensions</span>
                    <span className="font-medium text-[#1C1917]">{product.dimensions}</span>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'care' && (
              <div className="text-xs text-[#57534E] leading-relaxed space-y-2">
                <p>{product.care}</p>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-[#78716C]">
                  <li>Disclaimer: Actual product colours may vary slightly due to screen settings and photography lighting.</li>
                </ul>
                <p className="text-[11px] text-[#967029] font-medium">
                  Tip: Always air your silk sarees in shade twice a year and refold along different lines to avoid zari crease wear.
                </p>
              </div>
            )}

            {activeTab === 'shipping' && (
              <div className="space-y-3 text-xs text-[#57534E]">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#967029]" />
                  <span>{announcementText} Packed in weather-sealed bespoke rigid boxes.</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#967029]" />
                  <span>Includes Silk Mark authentication label & craft provenance docket.</span>
                </div>
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#967029]" />
                  <span>{exchangeWindow}-day door-to-door returns for unstitched sarees & home textiles.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <MobileImageViewer
        isOpen={isImageViewerOpen}
        onClose={() => setIsImageViewerOpen(false)}
        images={images}
        initialIndex={currentImageIndex}
        productName={product.name}
      />
    </div>
  );
};
