import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Product, ProductCategory, CollectionCategory, ProductVariant, ProductVariantImage, ProductImageRole } from '../types';
import { PRODUCTS, CATEGORIES } from '../data/catalog';
import { normalizeImageUrl } from '../lib/imageHelper';
import { resolveCanonicalColor } from '../lib/colorSystem';

export interface ProductFilterOptions {
  category?: ProductCategory;
  subCategory?: string;
  onSale?: boolean;
  featured?: boolean;
  limit?: number;
}

export const productService = {
  /**
   * Fetch all active categories from Supabase (or fallback to catalog data)
   */
  async getCategories(): Promise<CollectionCategory[]> {
    if (!isSupabaseConfigured()) {
      return CATEGORIES;
    }

    try {
      const { data, error } = await (supabase as any)
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error || !data || data.length === 0) {
        return CATEGORIES;
      }

      return data.map((cat: any) => ({
        id: cat.id,
        title: cat.name,
        subtitle: cat.description || '',
        category: cat.slug as ProductCategory,
        image: normalizeImageUrl(cat.image_url || ''),
        itemCount: 0,
      }));
    } catch {
      return CATEGORIES;
    }
  },

  /**
   * Fetch active products with filtering and sorting
   */
  async getProducts(options: ProductFilterOptions = {}): Promise<Product[]> {
    if (!isSupabaseConfigured()) {
      let list = [...PRODUCTS];

      if (options.category && options.category !== 'all') {
        list = list.filter((p) => p.category === options.category);
      }
      if (options.subCategory && options.subCategory !== 'all') {
        list = list.filter((p) => p.subCategory === options.subCategory);
      }
      if (options.onSale) {
        list = list.filter((p) => p.onSale);
      }
      if (options.featured) {
        list = list.filter((p) => p.featured);
      }
      if (options.limit) {
        list = list.slice(0, options.limit);
      }

      return list;
    }

    try {
      let query = (supabase as any)
        .from('products')
        .select(`
          *,
          category:categories(name, slug),
          images:product_images(id, image_url, storage_path, alt_text, is_primary, sort_order, variant_id, role, fit, focal_x, focal_y, scale),
          variants:product_variants(*)
        `)
        .eq('status', 'active');

      if (options.featured) {
        query = query.eq('featured', true);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[productService.getProducts] Supabase query failed; storefront products unavailable:', error.message);
        return [];
      }
      if (!data || data.length === 0) {
        return [];
      }

      const mapped: Product[] = data.map((item: any) => {
        // Prioritize general product primary image, or fallback to first primary image
        const rawImages = item.images || [];
        const primaryImg =
          rawImages.find((img: any) => img.is_primary && !img.variant_id)?.image_url ||
          (rawImages.find((img: any) => img.is_primary)?.image_url || rawImages.find((img: any) => img.is_primary)?.storage_path) ||
          (rawImages[0]?.image_url || rawImages[0]?.storage_path) ||
          '';

        const secondaryImg =
          (rawImages.find((img: any) => !img.is_primary && !img.variant_id)?.image_url || rawImages.find((img: any) => !img.is_primary && !img.variant_id)?.storage_path) ||
          (rawImages.find((img: any) => !img.is_primary)?.image_url || rawImages.find((img: any) => !img.is_primary)?.storage_path) ||
          (rawImages[1]?.image_url || rawImages[1]?.storage_path) ||
          primaryImg;

        const isCleanColor = (c: any) => {
          if (!c || typeof c !== 'string') return false;
          const clean = c.trim().toLowerCase();
          return clean !== '' && clean !== 'null' && clean !== 'undefined' && clean !== '—' && clean !== '-' && clean !== 'n/a' && clean !== 'none';
        };

        const colors = Array.from(
          new Set(
            item.variants
              ?.map((v: any) => v.color)
              .filter(isCleanColor) as string[]
          )
        );

        const sizes = Array.from(
          new Set(
            item.variants
              ?.map((v: any) => v.size || v.dimensions)
              .filter(Boolean) as string[]
          )
        );

        const totalStock = item.variants?.reduce((sum: number, v: any) => sum + (v.stock_quantity || 0), 0) ?? 0;

        const imagesWithRoles: ProductVariantImage[] = rawImages.map((img: any, idx: number) => {
          let role: ProductImageRole = (img.role as ProductImageRole) || (idx === 0 ? 'hero' : 'gallery');
          const alt = (img.alt_text || '').toLowerCase();
          if (!img.role) {
            if (alt.includes('pallu')) role = 'pallu';
            else if (alt.includes('border') || alt.includes('zari')) role = 'border';
            else if (alt.includes('texture') || alt.includes('weave')) role = 'texture';
            else if (alt.includes('full')) role = 'full_saree';
            else if (alt.includes('detail') || alt.includes('close')) role = 'detail';
            else if (alt.includes('model')) role = 'model';
            else if (alt.includes('lifestyle')) role = 'lifestyle';
          }

          return {
            id: img.id,
            imageUrl: normalizeImageUrl(img.image_url || img.storage_path),
            role,
            isPrimary: Boolean(img.is_primary),
            sortOrder: img.sort_order || idx + 1,
            variantId: img.variant_id || undefined,
            fit: (img.fit as 'cover' | 'contain') || 'cover',
            focalPositionX: img.focal_x ?? 50,
            focalPositionY: img.focal_y ?? 50,
            scale: img.scale ? Number(img.scale) : 1.0,
            altText: img.alt_text || item.name,
          };
        });

        const generalProductImages = imagesWithRoles.filter((img) => !img.variantId);

        const mappedVariants: ProductVariant[] = (item.variants || []).map((v: any) => {
          const vAttrs = v.attributes || {};

          // 1. Direct database relation: product_images where variant_id === v.id
          const dbVariantImages = imagesWithRoles.filter((img) => img.variantId === v.id);

          // 2. Attributes fallback: v.attributes.images
          let attrVariantImages: ProductVariantImage[] = [];
          if (Array.isArray(vAttrs.images) && vAttrs.images.length > 0) {
            attrVariantImages = vAttrs.images.map((vi: any, viIdx: number) => ({
              id: vi.id,
              imageUrl: normalizeImageUrl(typeof vi === 'string' ? vi : (vi.imageUrl || vi.image_url || vi.storage_path)),
              role: (typeof vi === 'object' && vi.role ? vi.role : viIdx === 0 ? 'hero' : 'gallery') as ProductImageRole,
              isPrimary: Boolean(vi.isPrimary),
              sortOrder: vi.sortOrder || viIdx + 1,
              variantId: v.id,
              variantSku: v.sku,
              fit: vi.fit || 'cover',
              focalPositionX: vi.focalPositionX ?? 50,
              focalPositionY: vi.focalPositionY ?? 50,
              scale: vi.scale ?? 1.0,
              altText: vi.altText || `${item.name} - ${v.variant_name}`,
            }));
          }

          // 3. Strict variant gallery resolution:
          // If this variant has specific images, use ONLY those images.
          // NEVER leak another variant's images into this variant!
          let finalVariantImages: ProductVariantImage[];
          if (dbVariantImages.length > 0) {
            finalVariantImages = dbVariantImages.sort((a, b) => {
              if (a.isPrimary && !b.isPrimary) return -1;
              if (!a.isPrimary && b.isPrimary) return 1;
              return (a.sortOrder || 0) - (b.sortOrder || 0);
            });
          } else if (attrVariantImages.length > 0) {
            finalVariantImages = attrVariantImages.sort((a, b) => {
              if (a.isPrimary && !b.isPrimary) return -1;
              if (!a.isPrimary && b.isPrimary) return 1;
              return (a.sortOrder || 0) - (b.sortOrder || 0);
            });
          } else {
            // No variant-specific images: use general product images (excluding images belonging to other variants)
            finalVariantImages = generalProductImages.length > 0 ? generalProductImages : imagesWithRoles;
          }

          const avail = Math.max(0, (v.stock_quantity || 0) - (v.reserved_quantity || 0));
          const hasColor = isCleanColor(v.color);
          const canonical = hasColor ? resolveCanonicalColor(v.color) : null;

          return {
            id: v.id,
            productId: item.id,
            sku: v.sku,
            variantName: v.variant_name || 'Standard',
            color: hasColor ? v.color : undefined,
            colorHexPrimary: vAttrs.colorHexPrimary || canonical?.hexPrimary || undefined,
            colorHexSecondary: vAttrs.colorHexSecondary || canonical?.hexSecondary || undefined,
            colorSwatchUrl: vAttrs.colorSwatchUrl || canonical?.swatchImageUrl || undefined,
            size: v.size || undefined,
            bedSize: v.bed_size || undefined,
            dimensions: v.dimensions || undefined,
            price: v.price_override ? Number(v.price_override) : Number(item.price),
            priceOverride: v.price_override ? Number(v.price_override) : null,
            mrpOverride: v.mrp_override ? Number(v.mrp_override) : null,
            stockQuantity: Number(v.stock_quantity || 0),
            reservedQuantity: Number(v.reserved_quantity || 0),
            availableQuantity: avail,
            isActive: v.is_active !== false,
            images: finalVariantImages,
            attributes: vAttrs,
          };
        });

        // Real Highlights derived truthfully from authentic product attributes
        const authenticHighlights: string[] = [];
        if (item.fabric) authenticHighlights.push(`${item.fabric} drape`);
        if (item.weave) authenticHighlights.push(`Handcrafted ${item.weave}`);
        if (item.origin) authenticHighlights.push(`Authentic provenance: ${item.origin}`);
        if (item.dimensions) authenticHighlights.push(`${item.dimensions}`);

        return {
          id: item.id,
          slug: item.slug,
          name: item.name,
          category: (item.category?.slug || item.category_slug || item.category) as ProductCategory || 'sarees',
          categoryId: item.category_id,
          collectionId: item.collection_id,
          subCategory: item.metadata?.sareeType || item.metadata?.subCategory || item.weave || undefined,
          metadata: item.metadata || {},
          categoryLabel: item.category?.name || 'Sarees',
          tag: item.metadata?.tag || (item.new_arrival ? 'New Arrival' : undefined),
          sku: item.sku || '',
          price: Number(item.price),
          gstRate: item.gst_rate === null || item.gst_rate === undefined ? null : Number(item.gst_rate),
          mrp: item.mrp ? Number(item.mrp) : undefined,
          status: item.status || 'active',
          onSale: Boolean(item.mrp && Number(item.mrp) > Number(item.price)),
          description: item.description || '',
          fabric: item.fabric || '',
          weave: item.weave || '',
          origin: item.origin || '',
          dimensions: item.dimensions || '',
          care: item.care_instructions || '',
          colors,
          sizes,
          primaryImage: normalizeImageUrl(primaryImg),
          secondaryImage: normalizeImageUrl(secondaryImg),
          additionalImages: item.images?.map((img: any) => normalizeImageUrl(img.image_url)) || [],
          imagesWithRoles,
          variants: mappedVariants,
          highlights: authenticHighlights,
          inStock: item.status === 'active' && (item.variants && item.variants.length > 0 ? totalStock > 0 : true),
          stockQuantity: totalStock,
          variantsCount: item.variants?.length || 0,
          featured: item.featured,
          bestSeller: item.bestseller,
          newArrival: item.new_arrival,
          seoTitle: item.seo_title,
          seoDescription: item.seo_description,
        };
      });

      return mapped;
    } catch (err) {
      console.error('[productService.getProducts] Unexpected storefront mapping error:', err);
      return [];
    }
  },

  /**
   * Fetch single product by its unique slug
   */
  async getProductBySlug(slug: string): Promise<Product | null> {
    const products = await this.getProducts();
    return products.find((p) => p.slug === slug) || null;
  },
};
