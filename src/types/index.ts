import { OrderStatus, PaymentStatus } from './database';

export type ProductCategory = 'all' | 'sarees' | 'bedsheets' | 'home-textiles' | 'sale';

export type ProductImageRole =
  | 'hero'
  | 'gallery'
  | 'full_saree'
  | 'pallu'
  | 'border'
  | 'texture'
  | 'lifestyle'
  | 'model'
  | 'thumbnail'
  | 'detail';

export interface ProductVariantImage {
  id?: string;
  imageUrl: string;
  /** Alternate URL/path from storage_path used if legacy image_url is stale. */
  fallbackImageUrl?: string;
  role?: ProductImageRole;
  isPrimary?: boolean;
  sortOrder?: number;
  altText?: string;
  variantId?: string;
  variantSku?: string;
  fit?: 'cover' | 'contain';
  focalPositionX?: string | number;
  focalPositionY?: string | number;
  scale?: number;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  variantName: string;
  color?: string;
  colorHexPrimary?: string;
  colorHexSecondary?: string;
  colorSwatchUrl?: string;
  size?: string;
  bedSize?: string;
  dimensions?: string;
  price?: number;
  priceOverride?: number | null;
  mrpOverride?: number | null;
  stockQuantity: number;
  reservedQuantity?: number;
  availableQuantity?: number;
  isActive: boolean;
  images?: ProductVariantImage[];
  attributes?: Record<string, any>;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  categoryId?: string;
  collectionId?: string;
  subCategory?: string; // e.g. 'Banarasi', 'Kanjivaram', 'Paithani', 'Chanderi', 'Handblock Cotton', 'Giza Sateen'
  categoryLabel: string;
  tag?: string; // e.g. "Pure Silk", "Handblock Printed", "Festive Edition"
  sku?: string;
  /** Managed product-level attributes stored in products.metadata JSONB. */
  metadata?: Record<string, any>;
  price: number;
  /** Optional product-level GST rate override; null means use the configured default. */
  gstRate?: number | null;
  mrp?: number;
  onSale?: boolean;
  status?: 'draft' | 'active' | 'archived';
  description: string;
  fabric: string;
  weave: string;
  origin: string;
  dimensions: string;
  care: string;
  colors?: string[];
  sizes?: string[];
  primaryImage: string;
  secondaryImage?: string;
  additionalImages?: string[];
  imagesWithRoles?: ProductVariantImage[];
  variants?: ProductVariant[];
  highlights?: string[];
  inStock: boolean;
  featured?: boolean;
  bestSeller?: boolean;
  newArrival?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  variantsCount?: number;
  stockQuantity?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  id?: string;
  variantId?: string;
  product: Product;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
  includeFallPico?: boolean;
  stockAvailable?: number;
}

export interface CollectionCategory {
  id: string;
  title: string;
  subtitle: string;
  category: ProductCategory;
  image: string;
  itemCount: number;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CollectionItem {
  id: string;
  title: string;
  slug: string;
  subtitle?: string;
  image?: string;
  bannerImage?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CustomerProfile {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  city?: string;
  pincode?: string;
  loyaltyCoins?: number;
  createdAt?: string;
}

export interface CustomerAddress {
  id: string;
  userId?: string;
  label: 'Home' | 'Work' | 'Other';
  recipientName: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  createdAt?: string;
  guestAccessToken?: string;
}

export interface OrderItemData {
  id?: string;
  orderId?: string;
  productVariantId?: string;
  productName: string;
  sku: string;
  price: number;
  quantity: number;
  totalAmount: number;
  productMetadata?: Record<string, any>;
  primaryImage?: string;
}

export interface PaymentData {
  id?: string;
  orderId: string;
  provider: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  providerSignature?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method?: string;
  errorReason?: string;
  verifiedAt?: string;
  createdAt?: string;
}

export interface OrderData {
  id: string;
  orderNumber: string;
  userId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  isGuest?: boolean;
  guestAccessToken?: string;
  shippingAddressSnapshot: CustomerAddress;
  billingAddressSnapshot?: CustomerAddress;
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  paymentMethod?: 'online' | 'cod';
  payment?: PaymentData;
  refundStatus?: 'not_applicable' | 'pending' | 'processing' | 'completed' | 'failed';
  cancelledAt?: string | null;
  cancellationReason?: string;
  courierName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  notes?: string;
  items?: OrderItemData[];
  createdAt: string;
  updatedAt?: string;
}

export type AdminSubView =
  | 'dashboard'
  | 'products'
  | 'products-new'
  | 'products-edit'
  | 'import'
  | 'categories'
  | 'collections'
  | 'inventory'
  | 'orders'
  | 'homepage'
  | 'settings'
  | 'coupons'
  | 'saree-types';

export type PageView =
  | { type: 'home' }
  | { type: 'collection'; category: ProductCategory; subCategory?: string }
  | { type: 'product'; slug: string }
  | { type: 'sale' }
  | { type: 'about' }
  | { type: 'faq' }
  | { type: 'contact' }
  | { type: 'wishlist' }
  | { type: 'cart' }
  | { type: 'checkout' }
  | {
      type: 'order-confirmation';
      orderId: string;
      orderNumber: string;
      paymentVerified?: boolean;
      paymentMethod?: 'online' | 'cod';
      guestAccessToken?: string;
    }
  | { type: 'login'; redirectAfter?: PageView }
  | { type: 'register'; redirectAfter?: PageView }
  | { type: 'forgot-password' }
  | { type: 'reset-password' }
  | { type: 'account'; tab?: 'profile' | 'addresses' | 'orders' | 'wishlist' }
  | { type: 'admin'; subView?: AdminSubView; productId?: string }
  | { type: 'admin-login' };
