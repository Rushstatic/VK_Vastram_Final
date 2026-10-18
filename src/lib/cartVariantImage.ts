import type { CartItem, Product, ProductVariant, ProductVariantImage } from '../types';

const usableUrl = (image?: ProductVariantImage | null): string =>
  typeof image?.imageUrl === 'string' ? image.imageUrl.trim() : '';

const sortImages = (images: ProductVariantImage[]): ProductVariantImage[] =>
  [...images].sort((a, b) => {
    if (Boolean(a.isPrimary) !== Boolean(b.isPrimary)) return a.isPrimary ? -1 : 1;
    return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
  });

/**
 * Resolve an image for the requested variant without ever borrowing another
 * variant's gallery. Product-level images are a safe fallback only when they
 * are not assigned to a specific variant.
 */
export function resolveVariantCartImage(
  product: Product,
  variantId?: string,
  color?: string
): string {
  const variants = product.variants || [];
  const variant: ProductVariant | undefined =
    (variantId ? variants.find((candidate) => candidate.id === variantId) : undefined) ||
    (color ? variants.find((candidate) => candidate.color?.trim().toLowerCase() === color.trim().toLowerCase()) : undefined);

  if (variant) {
    const variantImages = sortImages((variant.images || []).filter((image) => {
      if (!usableUrl(image)) return false;
      if (image.variantId && image.variantId !== variant.id) return false;
      if (image.variantSku && image.variantSku !== variant.sku) return false;
      return true;
    }));
    if (variantImages.length > 0) return usableUrl(variantImages[0]);
  }

  const roleImages = product.imagesWithRoles || [];
  const exactVariantImages = sortImages(roleImages.filter((image) => {
    if (!usableUrl(image)) return false;
    return Boolean(variant && (
      image.variantId === variant.id ||
      (image.variantSku && image.variantSku === variant.sku)
    ));
  }));
  if (exactVariantImages.length > 0) return usableUrl(exactVariantImages[0]);

  const generalImages = sortImages(roleImages.filter((image) =>
    !image.variantId && !image.variantSku && Boolean(usableUrl(image))
  ));
  if (generalImages.length > 0) return usableUrl(generalImages[0]);

  // Only use a product-level fallback when it is genuinely unscoped. If all
  // available images belong to other colors, do not silently display the wrong shade.
  const hasUnscopedPrimary = typeof product.primaryImage === 'string' && Boolean(product.primaryImage.trim()) &&
    !roleImages.some((image) => usableUrl(image) === product.primaryImage.trim() && (image.variantId || image.variantSku));
  if (hasUnscopedPrimary && !roleImages.some((image) => Boolean(usableUrl(image)) && !image.variantId && !image.variantSku)) {
    return product.primaryImage.trim();
  }
  return '';
}

/** Read an explicit snapshot first; resolve older guest-cart rows as a migration-safe fallback. */
export function getCartItemImage(item: CartItem): string {
  if (typeof item.selectedVariantImage === 'string') return item.selectedVariantImage;
  return resolveVariantCartImage(item.product, item.variantId, item.selectedColor);
}

/**
 * Compatibility repair for guest-cart rows created before variant identity was
 * passed through every Add to Bag callback. ProductCard snapshots the chosen
 * variant SKU/price into `product`, so prefer that exact SKU when it conflicts
 * with the legacy cart row's variant ID. Then align its color and image.
 */
export function reconcileCartItemVariant(item: CartItem): CartItem {
  const variants = item.product.variants || [];
  const variantFromSku = item.product.sku
    ? variants.find((variant) => variant.sku?.trim().toLowerCase() === item.product.sku?.trim().toLowerCase())
    : undefined;
  const variantFromColor = item.selectedColor
    ? variants.find((variant) => variant.color?.trim().toLowerCase() === item.selectedColor?.trim().toLowerCase())
    : undefined;
  const variantFromId = item.variantId
    ? variants.find((variant) => variant.id === item.variantId)
    : undefined;
  const resolvedVariant = variantFromSku || variantFromColor || variantFromId;
  const colorMismatch = Boolean(
    resolvedVariant?.color && item.selectedColor &&
    resolvedVariant.color.trim().toLowerCase() !== item.selectedColor.trim().toLowerCase()
  );
  const identityMismatch = Boolean(resolvedVariant && (
    resolvedVariant.id !== item.variantId || colorMismatch
  ));

  const selectedColor = resolvedVariant?.color || item.selectedColor;
  const selectedSize = identityMismatch
    ? (resolvedVariant?.size || resolvedVariant?.bedSize || resolvedVariant?.dimensions || item.selectedSize)
    : item.selectedSize;
  const selectedVariantImage = typeof item.selectedVariantImage === 'string' && !identityMismatch
    ? item.selectedVariantImage
    : resolveVariantCartImage(item.product, resolvedVariant?.id || item.variantId, selectedColor);

  const product: Product = {
    ...item.product,
    ...(identityMismatch && resolvedVariant?.sku ? { sku: resolvedVariant.sku } : {}),
    ...(identityMismatch && typeof resolvedVariant?.price === 'number' ? { price: resolvedVariant.price } : {}),
    ...(identityMismatch && resolvedVariant?.mrpOverride != null ? { mrp: resolvedVariant.mrpOverride } : {}),
    // This snapshot also protects older cart consumers that read product.primaryImage.
    primaryImage: selectedVariantImage,
  };

  const nextId = identityMismatch && resolvedVariant && item.id?.startsWith('guest-')
    ? `guest-${product.id}-${resolvedVariant.id}-${selectedSize || 'default'}-${item.includeFallPico ? 'fallpico' : 'plain'}`
    : item.id;

  return {
    ...item,
    id: nextId,
    variantId: resolvedVariant?.id || item.variantId,
    selectedColor,
    selectedSize,
    selectedVariantImage,
    product,
  };
}
