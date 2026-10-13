import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CartItem, Product, ProductCategory } from '../types';
import { normalizeImageUrl } from '../lib/imageHelper';
import { sanitizeQuantity, MAX_CART_ITEM_QUANTITY } from '../lib/validation';

const GUEST_CART_KEY = 'vk_guest_cart';

export const cartService = {
  /**
   * Get guest cart from local browser storage with strict schema and quantity sanitization
   */
  getGuestCart(): CartItem[] {
    try {
      const stored = localStorage.getItem(GUEST_CART_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item && item.product && item.product.id)
          .map((item) => {
            const cleanQty = sanitizeQuantity(item.quantity, item.stockAvailable || MAX_CART_ITEM_QUANTITY);
            return {
              ...item,
              quantity: cleanQty,
            };
          })
          .filter((item) => item.quantity > 0);
      }
      return [];
    } catch {
      return [];
    }
  },

  /**
   * Save guest cart to local browser storage safely with sanitized quantities
   */
  saveGuestCart(items: CartItem[]): void {
    try {
      if (!Array.isArray(items)) return;
      const valid = items
        .filter((item) => item && item.product && item.product.id)
        .map((item) => ({
          ...item,
          quantity: sanitizeQuantity(item.quantity, item.stockAvailable || MAX_CART_ITEM_QUANTITY),
        }))
        .filter((item) => item.quantity > 0);
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify(valid));
    } catch {
      // ignore
    }
  },

  /**
   * Clear guest cart
   */
  clearGuestCart(): void {
    try {
      localStorage.removeItem(GUEST_CART_KEY);
    } catch {
      // ignore
    }
  },

  /**
   * Get active cart for authenticated user
   */
  async getOrCreateUserCartId(userId: string): Promise<string | null> {
    if (!isSupabaseConfigured() || !userId) return null;

    try {
      // Look for active cart
      const { data: existingCart } = await (supabase as any)
        .from('carts')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (existingCart?.id) {
        return existingCart.id;
      }

      // Create new active cart
      const { data: newCart, error: createError } = await (supabase as any)
        .from('carts')
        .insert({ user_id: userId, status: 'active' })
        .select('id')
        .maybeSingle();

      if (createError || !newCart) return null;
      return newCart.id;
    } catch {
      return null;
    }
  },

  /**
   * Load cart items from Supabase for authenticated user (PURE READ OPERATION)
   * Must NEVER mutate database or merge guest cart or write to localStorage.
   */
  async getUserCart(userId: string): Promise<CartItem[]> {
    if (!isSupabaseConfigured() || !userId) {
      return this.getGuestCart();
    }

    try {
      const cartId = await this.getOrCreateUserCartId(userId);
      if (!cartId) return [];

      const { data, error } = await (supabase as any)
        .from('cart_items')
        .select(`
          id,
          quantity,
          metadata,
          variant:product_variants(
            id,
            sku,
            variant_name,
            color,
            size,
            bed_size,
            dimensions,
            stock_quantity,
            price_override,
            product:products(
              id,
              slug,
              name,
              price,
              mrp,
              category:categories(name, slug),
              images:product_images(image_url, is_primary)
            )
          )
        `)
        .eq('cart_id', cartId);

      if (error || !data) {
        return [];
      }

      const dbItems: CartItem[] = data
        .filter((item: any) => item && item.variant)
        .map((item: any) => {
          const v = item.variant;
          const p = v?.product;
          const primaryImg =
            p?.images?.find((i: any) => i.is_primary)?.image_url ||
            p?.images?.[0]?.image_url ||
            '/src/assets/images/hero_vastram_saree_1791192126882.jpg';

          const product: Product = {
            id: p?.id || v?.id || 'c0000000-0000-0000-0000-000000000001',
            slug: p?.slug || 'product',
            name: p?.name || 'Handloom Creation',
            category: (p?.category?.slug as ProductCategory) || 'sarees',
            categoryLabel: p?.category?.name || 'Sarees',
            price: Number(v?.price_override || p?.price || 0),
            mrp: p?.mrp ? Number(p.mrp) : undefined,
            description: '',
            fabric: '',
            weave: '',
            origin: '',
            dimensions: v?.dimensions || '',
            care: '',
            primaryImage: normalizeImageUrl(primaryImg),
            inStock: (v?.stock_quantity || 0) > 0,
          };

          return {
            id: item.id,
            variantId: v?.id,
            product,
            quantity: sanitizeQuantity(item.quantity, v?.stock_quantity ?? MAX_CART_ITEM_QUANTITY),
            selectedColor: v?.color || undefined,
            selectedSize: v?.size || v?.bed_size || v?.dimensions || undefined,
            includeFallPico: item.metadata?.includeFallPico === true,
            stockAvailable: v?.stock_quantity ?? MAX_CART_ITEM_QUANTITY,
          };
        });

      return dbItems;
    } catch {
      return [];
    }
  },

  /**
   * Add or update an item in Supabase cart with quantity sanitization
   */
  async addItemToUserCart(
    userId: string,
    productId: string,
    variantId: string | undefined,
    quantity: number,
    color?: string,
    size?: string,
    includeFallPico = false
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !userId) {
      return { success: true };
    }

    const sanitizedAddQty = sanitizeQuantity(quantity);

    try {
      const cartId = await this.getOrCreateUserCartId(userId);
      if (!cartId) return { success: false, error: 'Could not access cart' };

      // Resolve only a real active, in-stock variant. Never fabricate stock or silently
      // pick the first database row (which may be sold out). Product detail pages pass
      // the selected variant ID explicitly.
      let targetVariantId = variantId;
      if (!targetVariantId) {
        const { data: variants, error: variantsError } = await (supabase as any)
          .from('product_variants')
          .select('id, stock_quantity, reserved_quantity, is_active')
          .eq('product_id', productId)
          .eq('is_active', true)
          .order('created_at', { ascending: true });
        if (variantsError) return { success: false, error: 'Could not verify product variants.' };
        const available = (variants || []).find((v: any) =>
          Number(v.stock_quantity || 0) - Number(v.reserved_quantity || 0) >= sanitizedAddQty
        );
        targetVariantId = available?.id;
      }

      if (!targetVariantId) {
        return { success: false, error: 'Product variant unavailable' };
      }

      // Check if already in cart
      const { data: variantItems, error: lookupError } = await (supabase as any)
        .from('cart_items')
        .select('id, quantity, metadata')
        .eq('cart_id', cartId)
        .eq('product_variant_id', targetVariantId);
      if (lookupError) return { success: false, error: 'Could not read the existing cart item.' };
      // Older cart rows may have no metadata; treat that as the plain (no Fall & Pico) option.
      const existingItem = (variantItems || []).find((item: any) =>
        Boolean(item.metadata?.includeFallPico) === Boolean(includeFallPico)
      );

      if (existingItem) {
        const currentQty = Number(existingItem.quantity) || 1;
        const newQty = sanitizeQuantity(currentQty + sanitizedAddQty);
        console.log(`[CART_MUTATION] source=ADD_TO_CART (increment) userId=${userId} productId=${productId} prevQty=${currentQty} addQty=${sanitizedAddQty} newQty=${newQty}`);
        const { error: updateError } = await (supabase as any)
          .from('cart_items')
          .update({ quantity: newQty, metadata: { ...(existingItem.metadata || {}), includeFallPico } })
          .eq('id', existingItem.id);
        if (updateError) return { success: false, error: updateError.message || 'Could not update cart item.' };
      } else {
        console.log(`[CART_MUTATION] source=ADD_TO_CART (new) userId=${userId} productId=${productId} qty=${sanitizedAddQty} fallPico=${includeFallPico}`);
        const { error: insertError } = await (supabase as any).from('cart_items').insert({
          cart_id: cartId,
          product_variant_id: targetVariantId,
          quantity: sanitizedAddQty,
          metadata: { includeFallPico },
        });
        if (insertError) return { success: false, error: insertError.message || 'Could not add item to cart.' };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error updating cart' };
    }
  },

  /**
   * Update quantity of a cart item in Supabase with sanitization
   */
  async updateItemQuantity(
    userId: string,
    cartItemId: string,
    quantity: number
  ): Promise<boolean> {
    if (!isSupabaseConfigured() || !userId) return true;

    try {
      if (quantity <= 0) {
        const { error } = await (supabase as any)
          .from('cart_items')
          .delete()
          .eq('id', cartItemId);
        return !error;
      } else {
        const sanitized = sanitizeQuantity(quantity);
        const { error } = await (supabase as any)
          .from('cart_items')
          .update({ quantity: sanitized })
          .eq('id', cartItemId);
        return !error;
      }
    } catch {
      return false;
    }
  },

  /**
   * Remove item from Supabase cart
   */
  async removeItemFromUserCart(userId: string, cartItemId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !userId) return true;

    try {
      const { error } = await (supabase as any)
        .from('cart_items')
        .delete()
        .eq('id', cartItemId);
      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Merge Guest Cart into Authenticated Supabase Cart ONCE upon explicit login.
   * MUST be idempotent and MUST clear the guest cart in localStorage afterwards.
   */
  async mergeGuestCartOnLogin(userId: string): Promise<CartItem[]> {
    const guestItems = this.getGuestCart();
    if (guestItems.length === 0) {
      return this.getUserCart(userId);
    }

    if (!isSupabaseConfigured() || !userId) {
      return guestItems;
    }

    try {
      console.log(`[CART_MUTATION] source=MERGE_GUEST_CART userId=${userId} guestItemsCount=${guestItems.length}`);

      const cartId = await this.getOrCreateUserCartId(userId);
      if (!cartId) return guestItems;

      // Fetch existing items in user's DB cart
      const { data: existingDbItems } = await (supabase as any)
        .from('cart_items')
        .select('id, product_variant_id, quantity')
        .eq('cart_id', cartId);

      for (const guestItem of guestItems) {
        try {
          // Find target variant ID
          let targetVariantId = guestItem.variantId;
          if (!targetVariantId) {
            const { data: variants, error: variantsError } = await (supabase as any)
              .from('product_variants')
              .select('id, stock_quantity, reserved_quantity, is_active')
              .eq('product_id', guestItem.product.id)
              .eq('is_active', true)
              .order('created_at', { ascending: true });
            if (variantsError) {
              console.warn('[CART_MUTATION] Could not resolve guest cart variant:', variantsError.message);
              continue;
            }
            const requiredQty = sanitizeQuantity(guestItem.quantity, MAX_CART_ITEM_QUANTITY);
            const availableVariant = (variants || []).find((v: any) =>
              Number(v.stock_quantity || 0) - Number(v.reserved_quantity || 0) >= requiredQty
            );
            targetVariantId = availableVariant?.id;
            if (!targetVariantId) {
              console.warn('[CART_MUTATION] Skipping guest cart item with no available variant:', guestItem.product.name);
              continue;
            }
          }

          if (targetVariantId) {
            const existing = existingDbItems?.find(
              (dbItem: any) => dbItem.product_variant_id === targetVariantId
            );

            if (existing) {
              // IDEMPOTENT: Set to the higher quantity, DO NOT compound additively on repeat passes
              const targetQty = sanitizeQuantity(
                Math.max(Number(existing.quantity) || 1, guestItem.quantity),
                guestItem.stockAvailable
              );
              await (supabase as any)
                .from('cart_items')
                .update({ quantity: targetQty, metadata: { includeFallPico: Boolean(guestItem.includeFallPico) } })
                .eq('id', existing.id);
            } else {
              // Insert new line
              await (supabase as any).from('cart_items').insert({
                cart_id: cartId,
                product_variant_id: targetVariantId,
                quantity: sanitizeQuantity(guestItem.quantity, guestItem.stockAvailable),
                metadata: { includeFallPico: Boolean(guestItem.includeFallPico) },
              });
            }
          }
        } catch (err) {
          console.warn('[CART_MUTATION] Error merging guest item:', err);
        }
      }

      // CRITICAL: Immediately clear guest cart from localStorage so it cannot be merged again!
      this.clearGuestCart();

      // Return fresh authoritative merged items from DB
      return this.getUserCart(userId);
    } catch (err) {
      console.warn('[CART_MUTATION] Merge guest cart failed:', err);
      return this.getUserCart(userId);
    }
  },
};

