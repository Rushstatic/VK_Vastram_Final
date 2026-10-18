import { strictEqual } from 'node:assert';
import { getCartItemImage, reconcileCartItemVariant, resolveVariantCartImage } from '../src/lib/cartVariantImage';
import type { CartItem, Product } from '../src/types';

const product: Product = {
  id: 'product-royal-deshpande',
  slug: 'royal-deshpande-saree',
  name: 'Royal deshpande saree',
  category: 'sarees',
  categoryLabel: 'Sarees',
  sku: 'VKV-SAR-307-01',
  price: 3400,
  description: '',
  fabric: 'Silk blend',
  weave: 'Handloom',
  origin: 'India',
  dimensions: 'Standard',
  care: '',
  primaryImage: 'https://images.example.test/saoda-selfie.jpg', // intentionally wrong for Mogambo
  imagesWithRoles: [
    { imageUrl: 'https://images.example.test/mogambo-krishna.jpg', variantId: 'variant-mogambo', isPrimary: true },
    { imageUrl: 'https://images.example.test/saoda-selfie.jpg', variantId: 'variant-saoda', isPrimary: true },
  ],
  variants: [
    {
      id: 'variant-mogambo', productId: 'product-royal-deshpande', sku: 'VKV-SAR-307-01',
      variantName: 'Mogambo', color: 'Mogambo', stockQuantity: 5, isActive: true,
      images: [{ imageUrl: 'https://images.example.test/mogambo-krishna.jpg', variantId: 'variant-mogambo', isPrimary: true }],
    },
    {
      id: 'variant-saoda', productId: 'product-royal-deshpande', sku: 'VKV-SAR-307-02',
      variantName: 'Saoda', color: 'Saoda', stockQuantity: 5, isActive: true,
      images: [{ imageUrl: 'https://images.example.test/saoda-selfie.jpg', variantId: 'variant-saoda', isPrimary: true }],
    },
  ],
  inStock: true,
};

strictEqual(
  resolveVariantCartImage(product, 'variant-mogambo', 'Mogambo'),
  'https://images.example.test/mogambo-krishna.jpg',
  'Mogambo must resolve to the Mogambo variant image'
);
strictEqual(
  resolveVariantCartImage(product, 'variant-saoda', 'Saoda'),
  'https://images.example.test/saoda-selfie.jpg',
  'Saoda must resolve to the Saoda variant image'
);

const legacyGuestItem = {
  product,
  variantId: 'variant-mogambo',
  selectedColor: 'Mogambo',
  quantity: 1,
} as CartItem;
strictEqual(
  getCartItemImage(legacyGuestItem),
  'https://images.example.test/mogambo-krishna.jpg',
  'Legacy guest cart rows must resolve by variant ID, not product primary image'
);

const previouslyBrokenGuestItem = {
  id: 'guest-product-royal-deshpande-variant-saoda-default-plain',
  product: { ...product, primaryImage: 'https://images.example.test/saoda-selfie.jpg' },
  variantId: 'variant-saoda', // old code picked a variant independently of the swatch
  selectedColor: 'Mogambo',
  selectedSize: 'Standard',
  quantity: 1,
} as CartItem;
const repairedGuestItem = reconcileCartItemVariant(previouslyBrokenGuestItem);
strictEqual(repairedGuestItem.variantId, 'variant-mogambo', 'legacy cart SKU must be reconciled to the swatch-selected variant');
strictEqual(repairedGuestItem.selectedColor, 'Mogambo', 'legacy cart color must match the selected variant');
strictEqual(repairedGuestItem.selectedVariantImage, 'https://images.example.test/mogambo-krishna.jpg', 'legacy cart image must match the selected variant');
strictEqual(repairedGuestItem.product.primaryImage, 'https://images.example.test/mogambo-krishna.jpg', 'legacy cart product snapshot must also be corrected');

const imageLessVariantProduct: Product = {
  ...product,
  imagesWithRoles: product.imagesWithRoles?.filter((image) => image.variantId !== 'variant-mogambo'),
  variants: product.variants?.map((variant) => variant.id === 'variant-mogambo' ? { ...variant, images: [] } : variant),
};
strictEqual(
  resolveVariantCartImage(imageLessVariantProduct, 'variant-mogambo', 'Mogambo'),
  '',
  'A variant without its own image must not borrow another variant image when no general image exists'
);

console.log('Cart variant image resolution checks passed.');
