import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Product, ProductCategory } from '../types';
import { PRODUCTS, CATEGORIES } from '../data/catalog';
import { optimizeImageBeforeUpload } from '../lib/imageOptimizer';
import { normalizeImageUrl } from '../lib/imageHelper';
import { formatVariantSku } from '../lib/skuHelper';

export interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  lowStockCount: number;
  categoriesCount: number;
  collectionsCount: number;
  recentProducts: Product[];
  ordersToday?: number;
  pendingPaymentCount?: number;
  ordersToPack?: number;
  ordersToShip?: number;
  outForDeliveryCount?: number;
  deliveredCount?: number;
  revenue?: number;
}

export interface InventoryItem {
  variantId: string;
  productId: string;
  productName: string;
  categoryLabel: string;
  sku: string;
  variantName: string;
  color?: string;
  size?: string;
  stockQuantity: number;
  reservedQuantity: number;
  soldQuantity?: number;
  availableQuantity: number;
  lowStockThreshold?: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  updatedAt: string;
  price?: number;
  imageUrl?: string;
}

export interface CategoryAdminData {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  productCount?: number;
}

export interface CollectionAdminData {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  bannerImageUrl: string;
  sortOrder: number;
  isActive: boolean;
  productCount?: number;
}

export interface HeroSlide {
  id: string;
  desktopImage: string;
  mobileImage?: string;
  eyebrow?: string;
  heading: string;
  description: string;
  primaryCtaText: string;
  primaryCtaUrl: string;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
  badge?: string;
  sortOrder: number;
  isActive: boolean;
  fit?: 'cover' | 'contain';
  focalPositionX?: string;
  focalPositionY?: string;
  scale?: number;
}

export interface HomepageSectionData {
  id: string;
  sectionType: string;
  title: string;
  subtitle: string;
  content: Record<string, any>;
  imageUrl: string;
  mobileImageUrl: string;
  buttonText: string;
  buttonUrl: string;
  sortOrder: number;
  isActive: boolean;
}

// Local mock store for local development if Supabase credentials are absent
let localProducts: Product[] = [...PRODUCTS];

// Local memory cache for homepage sections to prevent visual flash
let cachedHomepageSectionsMemory: HomepageSectionData[] | null = null;

const HOMEPAGE_CACHE_KEY = 'vk_homepage_sections_cache';

export const adminService = {
  /**
   * Synchronously get cached homepage sections from memory or sessionStorage/localStorage
   */
  getCachedHomepageSections(): HomepageSectionData[] | null {
    if (cachedHomepageSectionsMemory) return cachedHomepageSectionsMemory;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(HOMEPAGE_CACHE_KEY) || sessionStorage.getItem(HOMEPAGE_CACHE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            cachedHomepageSectionsMemory = parsed;
            return parsed;
          }
        }
      } catch {
        // ignore
      }
    }
    return null;
  },

  /**
   * Auto SKU Generation — Authoritative & Sequential by Category
   */
  async generateAutoSku(category: string = 'sarees'): Promise<string> {
    let prefix = 'VKV-SAR';
    if (category === 'bedsheets' || category === 'bedding') prefix = 'VKV-BED';
    else if (category === 'home-textiles' || category === 'home') prefix = 'VKV-TEX';
    else if (category !== 'sarees') prefix = 'VKV-OTH';

    if (!isSupabaseConfigured()) {
      const matching = localProducts.filter((p) => p.sku && p.sku.startsWith(prefix));
      let maxNum = 0;
      for (const p of matching) {
        if (!p.sku) continue;
        const parts = p.sku.split('-');
        const last = parts[parts.length - 1];
        const num = parseInt(last, 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
      return `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
    }

    try {
      // Query database for all products or variants with matching prefix
      const [{ data: products }, { data: variants }] = await Promise.all([
        (supabase as any).from('products').select('sku').ilike('sku', `${prefix}-%`),
        (supabase as any).from('product_variants').select('sku').ilike('sku', `${prefix}-%`),
      ]);

      let maxNum = 0;
      const allSkus = [
        ...(products || []).map((p: any) => p.sku),
        ...(variants || []).map((v: any) => v.sku),
      ].filter(Boolean);

      for (const currentSku of allSkus) {
        const match = currentSku.match(new RegExp(`${prefix}-(\\d+)`, 'i'));
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }

      return `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
    } catch {
      return `${prefix}-${String(Date.now()).slice(-3)}`;
    }
  },
  /**
   * Get Dashboard Metrics & Analytics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    if (!isSupabaseConfigured()) {
      const active = localProducts.filter((p) => p.status !== 'draft' && p.status !== 'archived').length;
      return {
        totalProducts: localProducts.length,
        activeProducts: active,
        draftProducts: localProducts.filter((p) => p.status === 'draft').length,
        lowStockCount: 2,
        categoriesCount: CATEGORIES.length,
        collectionsCount: 3,
        recentProducts: localProducts.slice(0, 5),
        ordersToday: 0,
        pendingPaymentCount: 0,
        ordersToPack: 0,
        ordersToShip: 0,
        outForDeliveryCount: 0,
        deliveredCount: 0,
        revenue: 0,
      };
    }

    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [
        { count: totalProducts },
        { count: activeProducts },
        { count: draftProducts },
        { count: categoriesCount },
        { count: collectionsCount },
        { data: lowStockVariants },
        { data: recentProductsData },
        { count: countToday },
        { count: pendingPay },
        { count: toPack },
        { count: toShip },
        { count: outForDeliv },
        { count: delivered },
        { data: paidOrders }
      ] = await Promise.all([
        (supabase as any).from('products').select('*', { count: 'exact', head: true }),
        (supabase as any).from('products').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        (supabase as any).from('products').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
        (supabase as any).from('categories').select('*', { count: 'exact', head: true }),
        (supabase as any).from('collections').select('*', { count: 'exact', head: true }),
        (supabase as any).from('product_variants').select('id').lt('stock_quantity', 5),
        (supabase as any)
          .from('products')
          .select('*, category:categories(name, slug), images:product_images(image_url, is_primary)')
          .order('updated_at', { ascending: false })
          .limit(5),
        (supabase as any).from('orders').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
        (supabase as any).from('orders').select('*', { count: 'exact', head: true }).eq('payment_status', 'pending'),
        (supabase as any).from('orders').select('*', { count: 'exact', head: true }).in('order_status', ['confirmed']),
        (supabase as any).from('orders').select('*', { count: 'exact', head: true }).in('order_status', ['packed', 'processing']),
        (supabase as any).from('orders').select('*', { count: 'exact', head: true }).eq('order_status', 'out_for_delivery'),
        (supabase as any).from('orders').select('*', { count: 'exact', head: true }).eq('order_status', 'delivered'),
        (supabase as any).from('orders').select('total_amount').in('payment_status', ['captured'])
      ]);

      const recentProducts: Product[] = (recentProductsData || []).map((p: any) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        category: (p.category?.slug as ProductCategory) || 'sarees',
        categoryLabel: p.category?.name || 'Sarees',
        price: Number(p.price),
        mrp: p.mrp ? Number(p.mrp) : undefined,
        status: p.status,
        description: p.description || '',
        fabric: p.fabric || '',
        weave: p.weave || '',
        origin: p.origin || '',
        dimensions: p.dimensions || '',
        care: p.care_instructions || '',
        primaryImage: p.images?.find((img: any) => img.is_primary)?.image_url || p.images?.[0]?.image_url || '',
        inStock: true,
        updatedAt: p.updated_at,
      }));

      const calculatedRevenue = (paidOrders || []).reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);

      return {
        totalProducts: totalProducts || 0,
        activeProducts: activeProducts || 0,
        draftProducts: draftProducts || 0,
        lowStockCount: lowStockVariants?.length || 0,
        categoriesCount: categoriesCount || 0,
        collectionsCount: collectionsCount || 0,
        recentProducts,
        ordersToday: countToday || 0,
        pendingPaymentCount: pendingPay || 0,
        ordersToPack: toPack || 0,
        ordersToShip: toShip || 0,
        outForDeliveryCount: outForDeliv || 0,
        deliveredCount: delivered || 0,
        revenue: calculatedRevenue,
      };
    } catch {
      return {
        totalProducts: localProducts.length,
        activeProducts: localProducts.length,
        draftProducts: 0,
        lowStockCount: 0,
        categoriesCount: 3,
        collectionsCount: 3,
        recentProducts: localProducts.slice(0, 5),
        ordersToday: 0,
        pendingPaymentCount: 0,
        ordersToPack: 0,
        ordersToShip: 0,
        outForDeliveryCount: 0,
        deliveredCount: 0,
        revenue: 0,
      };
    }
  },

  /**
   * Get Admin Products with search, filtering, and sorting
   */
  async getProducts(params?: {
    search?: string;
    category?: string;
    status?: string;
  }): Promise<Product[]> {
    if (!isSupabaseConfigured()) {
      let res = [...localProducts];
      if (params?.search) {
        const q = params.search.toLowerCase();
        res = res.filter((p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q));
      }
      if (params?.category && params.category !== 'all') {
        res = res.filter((p) => p.category === params.category);
      }
      if (params?.status && params.status !== 'all') {
        res = res.filter((p) => p.status === params.status);
      }
      return res;
    }

    try {
      let query = (supabase as any)
        .from('products')
        .select(`
          *,
          category:categories(id, name, slug),
          collection:collections(id, name, slug),
          images:product_images(image_url, is_primary, sort_order),
          variants:product_variants(*)
        `)
        .order('updated_at', { ascending: false });

      if (params?.status && params.status !== 'all') {
        query = query.eq('status', params.status);
      }
      if (params?.category && params.category !== 'all') {
        query = query.eq('category_id', params.category);
      }

      const { data, error } = await query;
      if (error || !data) return localProducts;

      let list: Product[] = data.map((item: any) => {
        const primaryImg =
          item.images?.find((img: any) => img.is_primary)?.image_url ||
          item.images?.[0]?.image_url ||
          '';

        const totalStock = item.variants?.reduce(
          (sum: number, v: any) => sum + (v.stock_quantity || 0),
          0
        );

        return {
          id: item.id,
          slug: item.slug,
          name: item.name,
          category: (item.category?.slug as ProductCategory) || 'sarees',
          categoryId: item.category_id,
          collectionId: item.collection_id,
          categoryLabel: item.category?.name || 'Sarees',
          sku: item.sku || '',
          price: Number(item.price),
          mrp: item.mrp ? Number(item.mrp) : undefined,
          status: item.status,
          featured: item.featured,
          bestSeller: item.bestseller,
          newArrival: item.new_arrival,
          description: item.description || '',
          fabric: item.fabric || '',
          weave: item.weave || '',
          origin: item.origin || '',
          dimensions: item.dimensions || '',
          care: item.care_instructions || '',
          seoTitle: item.seo_title || '',
          seoDescription: item.seo_description || '',
          primaryImage: primaryImg,
          additionalImages: item.images?.map((img: any) => img.image_url) || [],
          inStock: totalStock > 0,
          stockQuantity: totalStock,
          variantsCount: item.variants?.length || 0,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        };
      });

      if (params?.search) {
        const q = params.search.toLowerCase();
        list = list.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.sku?.toLowerCase().includes(q) ||
            p.fabric.toLowerCase().includes(q)
        );
      }

      return list;
    } catch {
      return localProducts;
    }
  },

  /**
   * Get single product with full images & variants
   */
  async getProductById(id: string): Promise<{
    product: Product;
    images: { id?: string; imageUrl: string; isPrimary: boolean; altText?: string; sortOrder: number }[];
    variants: any[];
  } | null> {
    if (!isSupabaseConfigured()) {
      const p = localProducts.find((item) => item.id === id || item.slug === id);
      if (!p) return null;
      return {
        product: p,
        images: [
          { imageUrl: p.primaryImage, isPrimary: true, sortOrder: 1 },
          ...(p.additionalImages || []).map((img, i) => ({ imageUrl: img, isPrimary: false, sortOrder: i + 2 })),
        ],
        variants: [
          {
            sku: p.sku || `${p.slug}-VAR-1`,
            variantName: 'Standard Free Size',
            stockQuantity: p.stockQuantity || 10,
            priceOverride: p.price,
          },
        ],
      };
    }

    try {
      const { data, error } = await (supabase as any)
        .from('products')
        .select(`
          *,
          category:categories(id, name, slug),
          collection:collections(id, name, slug),
          images:product_images(*),
          variants:product_variants(*)
        `)
        .or(`id.eq.${id},slug.eq.${id}`)
        .maybeSingle();

      if (error || !data) return null;

      const primaryImg =
        data.images?.find((img: any) => img.is_primary)?.image_url ||
        data.images?.[0]?.image_url ||
        '';

      const product: Product = {
        id: data.id,
        slug: data.slug,
        name: data.name,
        category: (data.category?.slug as ProductCategory) || 'sarees',
        categoryId: data.category_id,
        collectionId: data.collection_id,
        categoryLabel: data.category?.name || 'Sarees',
        sku: data.sku || '',
        price: Number(data.price),
        mrp: data.mrp ? Number(data.mrp) : undefined,
        status: data.status,
        featured: data.featured,
        bestSeller: data.bestseller,
        newArrival: data.new_arrival,
        description: data.description || '',
        fabric: data.fabric || '',
        weave: data.weave || '',
        origin: data.origin || '',
        dimensions: data.dimensions || '',
        care: data.care_instructions || '',
        seoTitle: data.seo_title || '',
        seoDescription: data.seo_description || '',
        primaryImage: primaryImg,
        inStock: true,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      const variants = data.variants || [];
      const variantIdToSkuMap = new Map(variants.map((v: any) => [v.id, v.sku]));

      const images = (data.images || [])
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((img: any) => ({
          id: img.id,
          imageUrl: img.image_url,
          isPrimary: Boolean(img.is_primary),
          altText: img.alt_text || '',
          sortOrder: img.sort_order,
          variantId: img.variant_id || undefined,
          variantSku: img.variant_id ? variantIdToSkuMap.get(img.variant_id) || 'all' : 'all',
          role: img.role || 'gallery',
          fit: img.fit || 'cover',
          focalPositionX: img.focal_x ?? 50,
          focalPositionY: img.focal_y ?? 50,
          scale: img.scale ? Number(img.scale) : 1.0,
        }));

      return {
        product,
        images,
        variants,
      };
    } catch {
      return null;
    }
  },

  /**
   * Create new product with images and variants
   */
  async createProduct(
    productData: Partial<Product>,
    images: { imageUrl: string; isPrimary: boolean; altText?: string }[],
    variants: any[]
  ): Promise<{ success: boolean; productId?: string; error?: string }> {
    // 1. Attempt authoritative server route first
    try {
      let token = '';
      if (isSupabaseConfigured()) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token || '';
      }

      const srvRes = await fetch('/api/admin/products/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          product: productData,
          images,
          variants,
        }),
      });

      if (srvRes.ok) {
        const srvData = await srvRes.json();
        if (srvData.success && srvData.productId) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('vk_products_updated'));
          }
          return { success: true, productId: srvData.productId };
        }
      }
    } catch (srvErr) {
      console.warn('Backend /api/admin/products/create failed, falling back to direct client insertion:', srvErr);
    }

    if (!isSupabaseConfigured()) {
      const newProduct: Product = {
        id: `local-${Date.now()}`,
        slug: productData.slug || `product-${Date.now()}`,
        name: productData.name || 'New Product',
        category: productData.category || 'sarees',
        categoryLabel: productData.category === 'bedsheets' ? 'Bedsheets' : 'Sarees',
        price: Number(productData.price || 0),
        mrp: productData.mrp ? Number(productData.mrp) : undefined,
        status: productData.status || 'active',
        description: productData.description || '',
        fabric: productData.fabric || '',
        weave: productData.weave || '',
        origin: productData.origin || '',
        dimensions: productData.dimensions || '',
        care: productData.care || '',
        primaryImage: images.find((i) => i.isPrimary)?.imageUrl || images[0]?.imageUrl || '',
        additionalImages: images.map((i) => i.imageUrl),
        inStock: true,
        featured: Boolean(productData.featured),
        bestSeller: Boolean(productData.bestSeller),
        newArrival: Boolean(productData.newArrival),
      };
      localProducts.unshift(newProduct);
      return { success: true, productId: newProduct.id };
    }

    try {
      // 1. Insert product
      const baseSku = productData.sku || `VKV-${Date.now().toString().slice(-6)}`;
      const { data: createdProduct, error: productError } = await (supabase as any)
        .from('products')
        .insert({
          name: productData.name,
          slug: productData.slug,
          sku: baseSku,
          category_id: productData.categoryId && productData.categoryId.trim() ? productData.categoryId.trim() : null,
          collection_id: productData.collectionId && productData.collectionId.trim() ? productData.collectionId.trim() : null,
          price: Number(productData.price) || 0,
          mrp: productData.mrp ? Number(productData.mrp) : null,
          status: productData.status || 'draft',
          featured: Boolean(productData.featured),
          bestseller: Boolean(productData.bestSeller),
          new_arrival: Boolean(productData.newArrival),
          description: productData.description || null,
          fabric: productData.fabric || null,
          weave: productData.weave || null,
          origin: productData.origin || null,
          dimensions: productData.dimensions || null,
          care_instructions: productData.care || null,
          seo_title: productData.seoTitle || null,
          seo_description: productData.seoDescription || null,
        })
        .select('id')
        .single();

      if (productError || !createdProduct) {
        return { success: false, error: productError?.message || 'Failed to create product record' };
      }

      const productId = createdProduct.id;

      // 2. Insert Variants first with standardized format (e.g. VKV-SAR-001-01)
      const variantSkuToIdMap = new Map<string, string>();
      if (variants.length > 0) {
        for (let idx = 0; idx < variants.length; idx++) {
          const v = variants[idx];
          const vSku = v.sku && v.sku.includes('-') && !v.sku.includes('-VAR-')
            ? v.sku.trim()
            : formatVariantSku(baseSku, idx + 1);

          const { data: insertedVar } = await (supabase as any)
            .from('product_variants')
            .insert({
              product_id: productId,
              sku: vSku,
              variant_name: v.variantName || 'Standard',
              color: v.color || null,
              size: v.size || null,
              bed_size: v.bedSize || null,
              dimensions: v.dimensions || null,
              price_override: v.priceOverride ? Number(v.priceOverride) : null,
              mrp_override: v.mrpOverride ? Number(v.mrpOverride) : null,
              stock_quantity: Number(v.stockQuantity || 0),
              is_active: v.isActive !== false,
              attributes: v.attributes || null,
            })
            .select('id')
            .single();

          if (insertedVar?.id) {
            variantSkuToIdMap.set(vSku, insertedVar.id);
            if (v.id) variantSkuToIdMap.set(v.id, insertedVar.id);
          }
        }
      }

      // 3. Insert Images with variant association, role, and presentation adjustment
      if (images.length > 0) {
        const imageRows = images.map((img: any, idx) => {
          const matchedVarId = img.variantId || (img.variantSku ? variantSkuToIdMap.get(img.variantSku) : null) || null;
          return {
            product_id: productId,
            variant_id: matchedVarId,
            image_url: img.imageUrl,
            alt_text: img.altText || productData.name,
            is_primary: Boolean(img.isPrimary),
            sort_order: img.sortOrder || idx + 1,
            role: img.role || (idx === 0 ? 'hero' : 'gallery'),
            fit: img.fit || 'cover',
            focal_x: img.focalPositionX ?? img.focal_x ?? 50,
            focal_y: img.focalPositionY ?? img.focal_y ?? 50,
            scale: img.scale ? Number(img.scale) : 1.0,
          };
        });

        await (supabase as any).from('product_images').insert(imageRows);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vk_products_updated'));
      }

      return { success: true, productId };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Database creation error' };
    }
  },

  /**
   * Update existing product with authoritative server endpoint and variant preservation
   */
  async updateProduct(
    id: string,
    productData: Partial<Product>,
    images?: { imageUrl: string; isPrimary: boolean; altText?: string }[],
    variants?: any[]
  ): Promise<{ success: boolean; error?: string }> {
    // 1. Attempt authoritative server route first
    try {
      let token = '';
      if (isSupabaseConfigured()) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token || '';
      }

      const srvRes = await fetch(`/api/admin/products/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          product: productData,
          images,
          variants,
        }),
      });

      if (srvRes.ok) {
        const srvData = await srvRes.json();
        if (srvData.success) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('vk_products_updated'));
          }
          return { success: true };
        }
      }
    } catch (srvErr) {
      console.warn('Backend /api/admin/products/:id failed, falling back to direct client update:', srvErr);
    }

    if (!isSupabaseConfigured()) {
      const idx = localProducts.findIndex((p) => p.id === id);
      if (idx !== -1) {
        localProducts[idx] = { ...localProducts[idx], ...productData };
      }
      return { success: true };
    }

    try {
      const categoryId = productData.categoryId && productData.categoryId.trim() ? productData.categoryId.trim() : null;
      const collectionId = productData.collectionId && productData.collectionId.trim() ? productData.collectionId.trim() : null;

      const { data: updatedRows, error: updateError } = await (supabase as any)
        .from('products')
        .update({
          name: productData.name,
          slug: productData.slug,
          sku: productData.sku,
          category_id: categoryId,
          collection_id: collectionId,
          price: productData.price !== undefined ? Number(productData.price) : undefined,
          mrp: productData.mrp ? Number(productData.mrp) : null,
          status: productData.status,
          featured: Boolean(productData.featured),
          bestseller: Boolean(productData.bestSeller),
          new_arrival: Boolean(productData.newArrival),
          description: productData.description,
          fabric: productData.fabric,
          weave: productData.weave,
          origin: productData.origin,
          dimensions: productData.dimensions,
          care_instructions: productData.care,
          seo_title: productData.seoTitle,
          seo_description: productData.seoDescription,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('id');

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      if (!updatedRows || updatedRows.length === 0) {
        return {
          success: false,
          error: 'Update permission denied. Please sign in as an authorized store administrator to update products.',
        };
      }

      // 1. Safe Variant Preservation - updates existing in-place, inserts new ones, and maps IDs
      const variantSkuToIdMap = new Map<string, string>();
      if (variants && variants.length > 0) {
        const { data: existingVariants } = await (supabase as any)
          .from('product_variants')
          .select('*')
          .eq('product_id', id);

        const existingMap = new Map((existingVariants || []).map((v: any) => [v.id, v]));
        const existingSkuMap = new Map((existingVariants || []).map((v: any) => [v.sku, v]));
        const baseSku = productData.sku || 'VKV';

        for (let i = 0; i < variants.length; i++) {
          const v = variants[i];
          const expectedSku = v.sku && v.sku.includes('-') && !v.sku.includes('-VAR-')
            ? v.sku.trim()
            : formatVariantSku(baseSku, i + 1);

          const matched = (v.id && existingMap.get(v.id)) || existingSkuMap.get(expectedSku);

          if (matched) {
            await (supabase as any)
              .from('product_variants')
              .update({
                sku: expectedSku,
                variant_name: v.variantName || matched.variant_name || 'Standard',
                color: v.color || null,
                size: v.size || null,
                bed_size: v.bedSize || null,
                dimensions: v.dimensions || null,
                price_override: v.priceOverride ? Number(v.priceOverride) : null,
                stock_quantity: Number(v.stockQuantity || 0),
                is_active: v.isActive !== false,
                attributes: v.attributes || matched.attributes || null,
              })
              .eq('id', matched.id);

            variantSkuToIdMap.set(expectedSku, matched.id);
            if (v.id) variantSkuToIdMap.set(v.id, matched.id);
          } else {
            const { data: insertedNew } = await (supabase as any).from('product_variants').insert({
              product_id: id,
              sku: expectedSku,
              variant_name: v.variantName || 'Standard',
              color: v.color || null,
              size: v.size || null,
              bed_size: v.bedSize || null,
              dimensions: v.dimensions || null,
              price_override: v.priceOverride ? Number(v.priceOverride) : null,
              stock_quantity: Number(v.stockQuantity || 0),
              is_active: v.isActive !== false,
              attributes: v.attributes || null,
            }).select('id').single();

            if (insertedNew?.id) {
              variantSkuToIdMap.set(expectedSku, insertedNew.id);
              if (v.id) variantSkuToIdMap.set(v.id, insertedNew.id);
            }
          }
        }
      }

      // 2. Sync Images if provided with variant association and presentation settings
      if (images && images.length > 0) {
        await (supabase as any).from('product_images').delete().eq('product_id', id);

        const imageRows = images.map((img: any, i) => {
          const matchedVarId = img.variantId || (img.variantSku ? variantSkuToIdMap.get(img.variantSku) : null) || null;
          return {
            product_id: id,
            variant_id: matchedVarId,
            image_url: img.imageUrl,
            alt_text: img.altText || productData.name,
            is_primary: Boolean(img.isPrimary),
            sort_order: img.sortOrder || i + 1,
            role: img.role || (i === 0 ? 'hero' : 'gallery'),
            fit: img.fit || 'cover',
            focal_x: img.focalPositionX ?? img.focal_x ?? 50,
            focal_y: img.focalPositionY ?? img.focal_y ?? 50,
            scale: img.scale ? Number(img.scale) : 1.0,
          };
        });
        await (supabase as any).from('product_images').insert(imageRows);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vk_products_updated'));
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Database update error' };
    }
  },

  /**
   * Change product status (Publish, Draft, Archive)
   */
  async setProductStatus(id: string, status: 'draft' | 'active' | 'archived'): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      const p = localProducts.find((item) => item.id === id);
      if (p) p.status = status;
      return true;
    }

    try {
      const { error } = await (supabase as any)
        .from('products')
        .update({ status })
        .eq('id', id);
      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Get Categories for CMS
   */
  async getCategories(): Promise<CategoryAdminData[]> {
    if (!isSupabaseConfigured()) {
      return CATEGORIES.map((c, i) => ({
        id: c.id,
        name: c.title,
        slug: c.category,
        description: c.subtitle,
        imageUrl: c.image,
        sortOrder: i + 1,
        isActive: true,
        productCount: 8,
      }));
    }

    try {
      const { data, error } = await (supabase as any)
        .from('categories')
        .select('*, products:products(id)')
        .order('sort_order', { ascending: true });

      if (error || !data) return [];

      return data.map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description || '',
        imageUrl: normalizeImageUrl(cat.image_url || ''),
        sortOrder: cat.sort_order,
        isActive: cat.is_active,
        productCount: cat.products?.length || 0,
      }));
    } catch {
      return [];
    }
  },

  /**
   * Create or Update Category
   */
  async saveCategory(data: Partial<CategoryAdminData>): Promise<boolean> {
    if (!isSupabaseConfigured()) return true;

    try {
      if (data.id && !data.id.startsWith('new-')) {
        const { error } = await (supabase as any)
          .from('categories')
          .update({
            name: data.name,
            slug: data.slug,
            description: data.description,
            image_url: data.imageUrl,
            sort_order: data.sortOrder,
            is_active: data.isActive,
          })
          .eq('id', data.id);
        return !error;
      } else {
        const { error } = await (supabase as any).from('categories').insert({
          name: data.name,
          slug: data.slug,
          description: data.description,
          image_url: data.imageUrl,
          sort_order: data.sortOrder || 1,
          is_active: data.isActive ?? true,
        });
        return !error;
      }
    } catch {
      return false;
    }
  },

  /**
   * Get Collections for CMS
   */
  async getCollections(): Promise<CollectionAdminData[]> {
    if (!isSupabaseConfigured()) {
      return [
        {
          id: 'col-1',
          name: 'Heritage Sarees',
          slug: 'heritage-sarees',
          description: 'Master handwoven silks from Kanchipuram and Varanasi',
          imageUrl: '/src/assets/images/hero_vastram_saree_1791192126882.jpg',
          bannerImageUrl: '/src/assets/images/hero_vastram_saree_1791192126882.jpg',
          sortOrder: 1,
          isActive: true,
          productCount: 12,
        },
        {
          id: 'col-2',
          name: 'Artisanal Bedsheets',
          slug: 'artisanal-bedsheets',
          description: 'Organic hand-block printed cotton bedsheets',
          imageUrl: '/src/assets/images/product_bedsheet_cotton_1791192169249.jpg',
          bannerImageUrl: '/src/assets/images/product_bedsheet_cotton_1791192169249.jpg',
          sortOrder: 2,
          isActive: true,
          productCount: 8,
        },
      ];
    }

    try {
      const { data, error } = await (supabase as any)
        .from('collections')
        .select('*, products:products(id)')
        .order('sort_order', { ascending: true });

      if (error || !data) return [];

      return data.map((col: any) => ({
        id: col.id,
        name: col.name,
        slug: col.slug,
        description: col.description || '',
        imageUrl: col.image_url || '',
        bannerImageUrl: col.banner_image_url || '',
        sortOrder: col.sort_order,
        isActive: col.is_active,
        productCount: col.products?.length || 0,
      }));
    } catch {
      return [];
    }
  },

  /**
   * Save Collection
   */
  async saveCollection(data: Partial<CollectionAdminData>): Promise<boolean> {
    if (!isSupabaseConfigured()) return true;

    try {
      if (data.id && !data.id.startsWith('new-')) {
        const { error } = await (supabase as any)
          .from('collections')
          .update({
            name: data.name,
            slug: data.slug,
            description: data.description,
            image_url: data.imageUrl,
            banner_image_url: data.bannerImageUrl,
            sort_order: data.sortOrder,
            is_active: data.isActive,
          })
          .eq('id', data.id);
        return !error;
      } else {
        const { error } = await (supabase as any).from('collections').insert({
          name: data.name,
          slug: data.slug,
          description: data.description,
          image_url: data.imageUrl,
          banner_image_url: data.bannerImageUrl,
          sort_order: data.sortOrder || 1,
          is_active: data.isActive ?? true,
        });
        return !error;
      }
    } catch {
      return false;
    }
  },

  /**
   * Get Inventory Ledger & Dashboard Summary
   */
  async getInventoryLedger(): Promise<{ items: InventoryItem[]; summary?: any }> {
    try {
      let token = '';
      if (isSupabaseConfigured()) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token || '';
      }

      const res = await fetch('/api/admin/inventory', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.items) {
          return { items: data.items, summary: data.summary };
        }
      }
    } catch (err) {
      console.warn('Server /api/admin/inventory call failed, using client fallback:', err);
    }

    if (!isSupabaseConfigured()) {
      const items: InventoryItem[] = [
        {
          variantId: 'var-1',
          productId: 'vk-001',
          productName: 'Royal Emerald Banarasi Katan Silk Saree',
          categoryLabel: 'Banarasi Silk',
          sku: 'VK-SAR-BAN-001-EME',
          variantName: 'Emerald Green',
          color: 'Emerald Green',
          stockQuantity: 12,
          reservedQuantity: 1,
          soldQuantity: 4,
          availableQuantity: 11,
          lowStockThreshold: 5,
          status: 'in_stock',
          updatedAt: new Date().toISOString(),
          price: 18500,
        },
        {
          variantId: 'var-2',
          productId: 'vk-002',
          productName: 'Crimson & Temple Zari Kanjivaram Silk Saree',
          categoryLabel: 'Kanjivaram Silk',
          sku: 'VK-SAR-KAN-002-CRM',
          variantName: 'Crimson Red',
          color: 'Crimson Red',
          stockQuantity: 3,
          reservedQuantity: 0,
          soldQuantity: 2,
          availableQuantity: 3,
          lowStockThreshold: 5,
          status: 'low_stock',
          updatedAt: new Date().toISOString(),
          price: 24000,
        },
        {
          variantId: 'var-3',
          productId: 'vk-004',
          productName: 'Indigo Bagh Hand-Block Printed Cotton Bedsheet Set',
          categoryLabel: 'Handblock Cotton',
          sku: 'VK-BED-BAG-004-KNG',
          variantName: 'King Size (108" x 108")',
          size: 'King',
          stockQuantity: 20,
          reservedQuantity: 2,
          soldQuantity: 8,
          availableQuantity: 18,
          lowStockThreshold: 5,
          status: 'in_stock',
          updatedAt: new Date().toISOString(),
          price: 4800,
        },
      ];

      return {
        items,
        summary: {
          totalProducts: 3,
          totalVariants: 3,
          inStockCount: 2,
          lowStockCount: 1,
          outOfStockCount: 0,
          totalReserved: 3,
          totalSold: 14,
          totalPhysical: 35,
        },
      };
    }

    try {
      const { data, error } = await (supabase as any)
        .from('product_variants')
        .select(`
          *,
          product:products(id, name, price, category:categories(name), images:product_images(image_url, is_primary))
        `)
        .order('stock_quantity', { ascending: true });

      if (error || !data) return { items: [] };

      const items: InventoryItem[] = data.map((v: any) => {
        const stock = v.stock_quantity || 0;
        const reserved = v.reserved_quantity || 0;
        const available = Math.max(0, stock - reserved);
        const threshold = v.low_stock_threshold || 5;

        let status: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
        if (available <= 0) status = 'out_of_stock';
        else if (available < threshold) status = 'low_stock';

        const p = v.product;
        const primaryImg =
          p?.images?.find((i: any) => i.is_primary)?.image_url ||
          p?.images?.[0]?.image_url ||
          '';

        return {
          variantId: v.id,
          productId: v.product_id,
          productName: p?.name || 'Unknown Product',
          categoryLabel: p?.category?.name || 'Textiles',
          sku: v.sku,
          variantName: v.variant_name,
          color: v.color,
          size: v.size || v.bed_size,
          stockQuantity: stock,
          reservedQuantity: reserved,
          soldQuantity: 0,
          availableQuantity: available,
          lowStockThreshold: threshold,
          status,
          updatedAt: v.updated_at,
          price: Number(v.price_override || p?.price || 0),
          imageUrl: primaryImg,
        };
      });

      return { items };
    } catch {
      return { items: [] };
    }
  },

  /**
   * Adjust Stock with Inventory Movement Ledger Record
   */
  async adjustStock(
    variantId: string,
    quantityChange: number,
    movementType: 'purchase' | 'sale' | 'return' | 'damage' | 'adjustment',
    notes: string
  ): Promise<{ success: boolean; newStock?: number; error?: string }> {
    try {
      let token = '';
      if (isSupabaseConfigured()) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token || '';
      }

      const res = await fetch('/api/admin/inventory/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          variantId,
          quantityChange,
          movementType,
          notes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          return { success: true, newStock: data.newStock };
        }
        return { success: false, error: data.error || 'Adjustment failed.' };
      }
    } catch (err) {
      console.warn('Server adjustStock call failed, using client fallback:', err);
    }

    if (!isSupabaseConfigured()) {
      return { success: true, newStock: 15 };
    }

    try {
      const { data: variant, error: varError } = await (supabase as any)
        .from('product_variants')
        .select('stock_quantity')
        .eq('id', variantId)
        .single();

      if (varError || !variant) {
        return { success: false, error: 'Variant not found' };
      }

      const newStock = Math.max(0, (variant.stock_quantity || 0) + quantityChange);

      const { error: updateError } = await (supabase as any)
        .from('product_variants')
        .update({ stock_quantity: newStock })
        .eq('id', variantId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      await (supabase as any).from('inventory_movements').insert({
        product_variant_id: variantId,
        movement_type: movementType,
        quantity: quantityChange,
        notes: notes || `Manual stock adjustment: ${movementType}`,
      });

      return { success: true, newStock };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Stock adjustment failed' };
    }
  },

  /**
   * Get Historical Inventory Movements
   */
  async getInventoryMovements(variantId?: string): Promise<any[]> {
    try {
      let token = '';
      if (isSupabaseConfigured()) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token || '';
      }

      const url = variantId
        ? `/api/admin/inventory/movements?variantId=${encodeURIComponent(variantId)}`
        : '/api/admin/inventory/movements';

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.movements) {
          return data.movements;
        }
      }
    } catch {
      // fallback
    }

    return [
      {
        id: 'mov-1',
        variantId: variantId || 'var-1',
        productName: 'Royal Emerald Banarasi Katan Silk Saree',
        sku: 'VK-SAR-BAN-001',
        movementType: 'purchase',
        quantity: 12,
        notes: 'Initial Loom Procurement Batch - Varanasi',
        createdBy: 'mama@vkvastram.com',
        createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
      },
      {
        id: 'mov-2',
        variantId: variantId || 'var-1',
        productName: 'Royal Emerald Banarasi Katan Silk Saree',
        sku: 'VK-SAR-BAN-001',
        movementType: 'sale',
        quantity: -1,
        referenceType: 'order',
        referenceId: 'VKV-202610-0012',
        notes: 'Confirmed Customer Order Payment',
        createdBy: 'System (Razorpay Webhook)',
        createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      },
    ];
  },

  /**
   * Update Low Stock Alert Threshold
   */
  async updateLowStockThreshold(variantId: string, threshold: number): Promise<boolean> {
    try {
      let token = '';
      if (isSupabaseConfigured()) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token || '';
      }

      const res = await fetch('/api/admin/inventory/threshold', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ variantId, threshold }),
      });

      if (res.ok) {
        const data = await res.json();
        return data.success;
      }
    } catch {
      // fallback
    }
    return true;
  },

  /**
   * Get paginated and filtered orders for administrator
   */
  async getOrders(params?: {
    search?: string;
    orderStatus?: string;
    paymentStatus?: string;
    customerType?: string;
    dateRange?: string;
    page?: number;
    limit?: number;
  }): Promise<{ success: boolean; orders: any[]; totalCount: number; page: number; limit: number; error?: string }> {
    try {
      let token = '';
      if (isSupabaseConfigured()) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token || '';
      }

      const queryParams = new URLSearchParams();
      if (params?.search) queryParams.set('search', params.search);
      if (params?.orderStatus) queryParams.set('orderStatus', params.orderStatus);
      if (params?.paymentStatus) queryParams.set('paymentStatus', params.paymentStatus);
      if (params?.customerType) queryParams.set('customerType', params.customerType);
      if (params?.dateRange) queryParams.set('dateRange', params.dateRange);
      if (params?.page) queryParams.set('page', String(params.page));
      if (params?.limit) queryParams.set('limit', String(params.limit));

      const res = await fetch(`/api/admin/orders?${queryParams.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, orders: [], totalCount: 0, page: 1, limit: 10, error: err?.message || 'Failed to fetch orders.' };
    }
  },

  /**
   * Get detailed single order by ID for administrator
   */
  async getOrderDetails(orderId: string): Promise<{ success: boolean; order?: any; error?: string }> {
    try {
      let token = '';
      if (isSupabaseConfigured()) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token || '';
      }

      const res = await fetch(`/api/admin/orders/${orderId}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to fetch order details.' };
    }
  },

  /**
   * Update order status with state-machine validation and timeline logging
   */
  async updateOrderStatus(
    orderId: string,
    orderStatus: string,
    paymentStatus?: string,
    notes?: string
  ): Promise<{ success: boolean; message?: string; orderStatus?: string; paymentStatus?: string; error?: string }> {
    try {
      let token = '';
      if (isSupabaseConfigured()) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token || '';
      }

      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ orderStatus, paymentStatus, notes }),
      });

      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error updating order status.' };
    }
  },

  /**
   * Update internal admin-only notes
   */
  async updateAdminNotes(orderId: string, notes: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      let token = '';
      if (isSupabaseConfigured()) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token || '';
      }

      const res = await fetch(`/api/admin/orders/${orderId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ notes }),
      });

      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error updating admin notes.' };
    }
  },

  /**
   * Cancel order and release reserved stock
   */
  async cancelOrder(orderId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      let token = '';
      if (isSupabaseConfigured()) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token || '';
      }

      const res = await fetch(`/api/admin/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error cancelling order.' };
    }
  },

  /**
   * Restock item upon customer return
   */
  async returnOrderItem(
    orderId: string,
    variantId: string,
    quantity: number,
    reason?: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      let token = '';
      if (isSupabaseConfigured()) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token || '';
      }

      const res = await fetch(`/api/admin/orders/${orderId}/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ variantId, quantity, reason }),
      });

      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error returning item.' };
    }
  },

  /**
   * Get Homepage CMS Sections (with memory and storage caching to eliminate visual flash)
   */
  async getHomepageSections(): Promise<HomepageSectionData[]> {
    if (!isSupabaseConfigured()) {
      const defaultSections: HomepageSectionData[] = [
        {
          id: 'sec-1',
          sectionType: 'hero',
          title: 'Timeless Indian Textiles for Modern Living.',
          subtitle: 'Authentic handwoven sarees, pure katan silks, and breathable organic cotton bedsheets.',
          content: { badge: 'The Heritage Loom' },
          imageUrl: '/src/assets/images/hero_vastram_saree_1791192126882.jpg',
          mobileImageUrl: '',
          buttonText: 'Explore Sarees',
          buttonUrl: '/sarees',
          sortOrder: 1,
          isActive: true,
        },
        {
          id: 'sec-2',
          sectionType: 'categories',
          title: 'Rooted in Craft, Woven for Every Space',
          subtitle: 'Explore our curated textile houses.',
          content: {},
          imageUrl: '',
          mobileImageUrl: '',
          buttonText: '',
          buttonUrl: '',
          sortOrder: 2,
          isActive: true,
        },
        {
          id: 'sec-3',
          sectionType: 'philosophy',
          title: 'The Dignity of Generational Handloom Weaving.',
          subtitle: 'Every saree is woven thread-by-thread by skilled master artisans.',
          content: {},
          imageUrl: '/src/assets/images/craft_textile_detail_1791192181572.jpg',
          mobileImageUrl: '',
          buttonText: 'Read Our Story',
          buttonUrl: '/about',
          sortOrder: 3,
          isActive: true,
        },
      ];
      cachedHomepageSectionsMemory = defaultSections;
      return defaultSections;
    }

    try {
      const { data, error } = await (supabase as any)
        .from('homepage_sections')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error || !data || data.length === 0) return [];

      const result: HomepageSectionData[] = data.map((sec: any) => ({
        id: sec.id,
        sectionType: sec.section_type,
        title: sec.title,
        subtitle: sec.subtitle || '',
        content: sec.content || {},
        imageUrl: sec.image_url || '',
        mobileImageUrl: sec.mobile_image_url || '',
        buttonText: sec.button_text || '',
        buttonUrl: sec.button_url || '',
        sortOrder: sec.sort_order,
        isActive: sec.is_active,
      }));

      // Cache result for instant 1st-paint rendering on page refresh
      cachedHomepageSectionsMemory = result;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(HOMEPAGE_CACHE_KEY, JSON.stringify(result));
          sessionStorage.setItem(HOMEPAGE_CACHE_KEY, JSON.stringify(result));
        } catch {
          // ignore
        }
      }

      return result;
    } catch {
      return [];
    }
  },

  /**
   * Save Homepage CMS Section & refresh cache
   */
  async saveHomepageSection(id: string, data: Partial<HomepageSectionData>): Promise<boolean> {
    if (!isSupabaseConfigured()) return true;

    try {
      const { error } = await (supabase as any)
        .from('homepage_sections')
        .update({
          title: data.title,
          subtitle: data.subtitle,
          content: data.content,
          image_url: data.imageUrl,
          mobile_image_url: data.mobileImageUrl,
          button_text: data.buttonText,
          button_url: data.buttonUrl,
          sort_order: data.sortOrder,
          is_active: data.isActive,
        })
        .eq('id', id);

      if (!error) {
        // Refresh cache asynchronously
        this.getHomepageSections();
      }

      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Check if Product is safe to hard delete (no order history or stock movements)
   */
  async checkProductDeleteSafety(productId: string): Promise<{
    safe: boolean;
    reason?: string;
    details?: { orderCount: number; movementCount: number; cartCount: number };
  }> {
    if (!isSupabaseConfigured()) {
      return { safe: true };
    }

    try {
      // Fetch product variants
      const { data: variants } = await (supabase as any)
        .from('product_variants')
        .select('id')
        .eq('product_id', productId);

      const variantIds = (variants || []).map((v: any) => v.id);

      // Check order_items referencing product or its variants
      let orderCount = 0;
      if (variantIds.length > 0) {
        const { count } = await (supabase as any)
          .from('order_items')
          .select('id', { count: 'exact', head: true })
          .in('variant_id', variantIds);
        orderCount = count || 0;
      }

      // Check inventory_movements referencing variants
      let movementCount = 0;
      if (variantIds.length > 0) {
        const { count } = await (supabase as any)
          .from('inventory_movements')
          .select('id', { count: 'exact', head: true })
          .in('product_variant_id', variantIds);
        movementCount = count || 0;
      }

      // Check cart_items
      let cartCount = 0;
      if (variantIds.length > 0) {
        const { count } = await (supabase as any)
          .from('cart_items')
          .select('id', { count: 'exact', head: true })
          .in('variant_id', variantIds);
        cartCount = count || 0;
      }

      if (orderCount > 0 || movementCount > 0) {
        return {
          safe: false,
          reason: `This product has historical transactional records (${orderCount} order(s), ${movementCount} inventory record(s)) and cannot be permanently deleted. Archive it instead to preserve audit history.`,
          details: { orderCount, movementCount, cartCount },
        };
      }

      return {
        safe: true,
        details: { orderCount: 0, movementCount: 0, cartCount },
      };
    } catch (err: any) {
      return { safe: false, reason: 'Failed to verify database safety checks: ' + err?.message };
    }
  },

  /**
   * Hard Delete Product safely with Storage Image Cleanup
   */
  async deleteProductSafely(productId: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) {
      localProducts = localProducts.filter((p) => p.id !== productId);
      return { success: true };
    }

    try {
      // 1. Safety check
      const safety = await this.checkProductDeleteSafety(productId);
      if (!safety.safe) {
        return { success: false, error: safety.reason };
      }

      // 2. Collect image URLs owned by this product for Storage cleanup
      const { data: productImages } = await (supabase as any)
        .from('product_images')
        .select('image_url')
        .eq('product_id', productId);

      const imageUrls = (productImages || []).map((i: any) => i.image_url).filter(Boolean);

      // 3. Delete DB rows (variants, images, then product)
      await (supabase as any).from('cart_items').delete().in('product_id', [productId]);
      await (supabase as any).from('product_images').delete().eq('product_id', productId);
      await (supabase as any).from('product_variants').delete().eq('product_id', productId);
      const { error: deleteError } = await (supabase as any).from('products').delete().eq('id', productId);

      if (deleteError) {
        return { success: false, error: deleteError.message };
      }

      // 4. Clean up Storage files ONLY if no other product/category/collection references them
      if (imageUrls.length > 0) {
        for (const url of imageUrls) {
          if (!url.includes('/store-assets/')) continue;

          // Check if any remaining product image uses this URL
          const { count: remainingCount } = await (supabase as any)
            .from('product_images')
            .select('id', { count: 'exact', head: true })
            .eq('image_url', url);

          if (!remainingCount || remainingCount === 0) {
            // Extract path from public URL
            const parts = url.split('/store-assets/');
            if (parts[1]) {
              const filePath = decodeURIComponent(parts[1]);
              await supabase.storage.from('store-assets').remove([filePath]);
            }
          }
        }
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to hard delete product.' };
    }
  },

  /**
   * Check if Category is safe to hard delete
   */
  async checkCategoryDeleteSafety(categoryId: string): Promise<{ safe: boolean; reason?: string; productCount: number }> {
    if (!isSupabaseConfigured()) return { safe: true, productCount: 0 };

    try {
      const { count } = await (supabase as any)
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', categoryId);

      const productCount = count || 0;
      if (productCount > 0) {
        return {
          safe: false,
          reason: `Category cannot be deleted because ${productCount} product(s) are currently assigned to it. Reassign or archive those products first.`,
          productCount,
        };
      }

      return { safe: true, productCount: 0 };
    } catch {
      return { safe: false, reason: 'Database verification failed', productCount: 0 };
    }
  },

  /**
   * Delete Category Safely
   */
  async deleteCategorySafely(categoryId: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) return { success: true };

    try {
      const check = await this.checkCategoryDeleteSafety(categoryId);
      if (!check.safe) return { success: false, error: check.reason };

      const { error } = await (supabase as any).from('categories').delete().eq('id', categoryId);
      return { success: !error, error: error?.message };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  },

  /**
   * Check if Collection is safe to hard delete
   */
  async checkCollectionDeleteSafety(collectionId: string): Promise<{ safe: boolean; reason?: string; productCount: number }> {
    if (!isSupabaseConfigured()) return { safe: true, productCount: 0 };

    try {
      const { count } = await (supabase as any)
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('collection_id', collectionId);

      const productCount = count || 0;
      if (productCount > 0) {
        return {
          safe: false,
          reason: `Collection cannot be deleted because ${productCount} product(s) reference it. Reassign products or archive the collection instead.`,
          productCount,
        };
      }

      return { safe: true, productCount: 0 };
    } catch {
      return { safe: false, reason: 'Database verification failed', productCount: 0 };
    }
  },

  /**
   * Delete Collection Safely
   */
  async deleteCollectionSafely(collectionId: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) return { success: true };

    try {
      const check = await this.checkCollectionDeleteSafety(collectionId);
      if (!check.safe) return { success: false, error: check.reason };

      const { error } = await (supabase as any).from('collections').delete().eq('id', collectionId);
      return { success: !error, error: error?.message };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  },

  /**
   * Global Admin Search — Covers Products, Categories, Collections, Orders
   */
  async globalAdminSearch(query: string): Promise<{
    products: { id: string; name: string; sku: string; price: number; category: string }[];
    categories: { id: string; name: string; slug: string }[];
    collections: { id: string; name: string; slug: string }[];
    orders: { id: string; orderNumber: string; customerName: string; totalAmount: number; orderStatus: string }[];
  }> {
    const empty = { products: [], categories: [], collections: [], orders: [] };
    if (!query || query.trim().length < 2) return empty;

    const q = query.trim().toLowerCase();

    if (!isSupabaseConfigured()) {
      const products = localProducts
        .filter((p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
        .map((p) => ({ id: p.id, name: p.name, sku: p.sku || '', price: p.price, category: p.categoryLabel || 'Sarees' }));

      const categories = CATEGORIES.filter((c) => c.title.toLowerCase().includes(q)).map((c) => ({
        id: c.id,
        name: c.title,
        slug: c.category,
      }));

      return { products, categories, collections: [], orders: [] };
    }

    try {
      const [
        { data: prodData },
        { data: catData },
        { data: colData },
        { data: orderData },
      ] = await Promise.all([
        (supabase as any)
          .from('products')
          .select('id, name, sku, price, category:categories(name)')
          .or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
          .limit(6),
        (supabase as any)
          .from('categories')
          .select('id, name, slug')
          .ilike('name', `%${q}%`)
          .limit(5),
        (supabase as any)
          .from('collections')
          .select('id, name, slug')
          .ilike('name', `%${q}%`)
          .limit(5),
        (supabase as any)
          .from('orders')
          .select('id, order_number, customer_name, total_amount, order_status')
          .or(`order_number.ilike.%${q}%,customer_name.ilike.%${q}%,customer_email.ilike.%${q}%,customer_phone.ilike.%${q}%`)
          .limit(5),
      ]);

      return {
        products: (prodData || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          sku: p.sku || '',
          price: Number(p.price),
          category: p.category?.name || 'Sarees',
        })),
        categories: (catData || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
        })),
        collections: (colData || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
        })),
        orders: (orderData || []).map((o: any) => ({
          id: o.id,
          orderNumber: o.order_number,
          customerName: o.customer_name || 'Valued Patron',
          totalAmount: Number(o.total_amount),
          orderStatus: o.order_status,
        })),
      };
    } catch {
      return empty;
    }
  },

  /**
   * Upload image to Supabase Storage (bucket 'store-assets') with server-first persistence & client optimization
   */
  async uploadImage(file: File, folder: any = 'products'): Promise<{ url: string; path?: string }> {
    try {
      // 1. Optimize image client-side to WebP (preserving detail & aspect ratio)
      const validFolder = ['logo', 'homepage', 'banners', 'collections', 'categories', 'products', 'pages'].includes(folder)
        ? folder
        : 'products';

      let fileToUpload: File | Blob = file;
      let contentType = file.type || 'image/jpeg';
      let fileName = file.name;

      try {
        const optimized = await optimizeImageBeforeUpload(file, { folder: validFolder });
        fileToUpload = optimized.blob;
        contentType = optimized.format;
        fileName = optimized.file.name;
      } catch (optErr) {
        console.warn('Client optimization failed, proceeding with original file:', optErr);
      }

      // 2. Convert to base64 for secure server-side upload
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(fileToUpload);
      });

      const session = await supabase.auth.getSession();
      const token = session.data?.session?.access_token || '';

      const res = await fetch('/api/admin/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fileData: base64Data,
          filename: fileName,
          folder: validFolder,
          contentType,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.url) {
          return { url: data.url, path: data.path };
        }
      }

      // 3. Direct client fallback if backend is unavailable
      const ext = contentType === 'image/webp' ? 'webp' : fileName.split('.').pop() || 'jpg';
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      const path = `${validFolder}/${Date.now()}-${cleanName}.${ext}`;

      const { data, error } = await supabase.storage.from('store-assets').upload(path, fileToUpload, {
        cacheControl: '3600',
        contentType,
        upsert: true,
      });

      if (error || !data) {
        throw new Error(error?.message || 'Upload failed');
      }

      const { data: publicUrlData } = supabase.storage.from('store-assets').getPublicUrl(path);

      return {
        url: publicUrlData.publicUrl,
        path,
      };
    } catch (err: any) {
      console.error('Image upload failed:', err);
      throw err;
    }
  },
};
