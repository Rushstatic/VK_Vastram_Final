-- =====================================================================
-- VK VASTRAM SUPABASE INDEXES & ROW LEVEL SECURITY (RLS)
-- Migration: 20261005000002_indexes_and_rls.sql
-- =====================================================================

-- =====================================================================
-- 1. PERFORMANCE INDEXES
-- =====================================================================

-- Products & Variants
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_collection_id ON public.products(collection_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products(featured) WHERE featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_bestseller ON public.products(bestseller) WHERE bestseller = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_new_arrival ON public.products(new_arrival) WHERE new_arrival = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_price ON public.products(price);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON public.product_variants(sku);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_primary ON public.product_images(product_id) WHERE is_primary = TRUE;

-- Orders & Order Items
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON public.orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_variant_id ON public.order_items(product_variant_id);

-- Carts
CREATE INDEX IF NOT EXISTS idx_carts_user_id ON public.carts(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON public.cart_items(cart_id);

-- Reviews
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);

-- Addresses
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON public.addresses(user_id);

-- Inventory
CREATE INDEX IF NOT EXISTS idx_inventory_movements_variant_id ON public.inventory_movements(product_variant_id);

-- =====================================================================
-- 2. SECURITY DEFINER HELPER FUNCTIONS & TRIGGERS
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to prevent customers from escalating their own role to 'admin'
CREATE OR REPLACE FUNCTION public.guard_profile_role_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Security Violation: Only an existing administrator can modify user roles.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_guard_profile_role ON public.profiles;
CREATE TRIGGER trg_guard_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_role_update();

-- =====================================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- =====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 4. RLS POLICIES
-- =====================================================================

-- --- PROFILES ---
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin(auth.uid()));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND (
      (role = (SELECT role FROM public.profiles WHERE id = auth.uid()))
      OR public.is_admin(auth.uid())
    )
  );

CREATE POLICY "Admins have full access to profiles"
  ON public.profiles FOR ALL
  USING (public.is_admin(auth.uid()));

-- --- ADDRESSES ---
CREATE POLICY "Users can manage own addresses"
  ON public.addresses FOR ALL
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- --- CATEGORIES & COLLECTIONS ---
CREATE POLICY "Public can view active categories"
  ON public.categories FOR SELECT
  USING (is_active = TRUE OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage categories"
  ON public.categories FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Public can view active collections"
  ON public.collections FOR SELECT
  USING (is_active = TRUE OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage collections"
  ON public.collections FOR ALL
  USING (public.is_admin(auth.uid()));

-- --- PRODUCTS, IMAGES & VARIANTS ---
CREATE POLICY "Public can view active products"
  ON public.products FOR SELECT
  USING (status = 'active' OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage products"
  ON public.products FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Public can view product images"
  ON public.product_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND (p.status = 'active' OR public.is_admin(auth.uid()))
    )
  );

CREATE POLICY "Admins can manage product images"
  ON public.product_images FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Public can view active variants"
  ON public.product_variants FOR SELECT
  USING (
    is_active = TRUE OR public.is_admin(auth.uid())
  );

CREATE POLICY "Admins can manage product variants"
  ON public.product_variants FOR ALL
  USING (public.is_admin(auth.uid()));

-- --- INVENTORY MOVEMENTS ---
CREATE POLICY "Admins can manage inventory movements"
  ON public.inventory_movements FOR ALL
  USING (public.is_admin(auth.uid()));

-- --- CARTS & CART ITEMS ---
CREATE POLICY "Users can manage own cart"
  ON public.carts FOR ALL
  USING (auth.uid() = user_id OR user_id IS NULL OR public.is_admin(auth.uid()));

CREATE POLICY "Users can manage own cart items"
  ON public.cart_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.carts c
      WHERE c.id = cart_id AND (c.user_id = auth.uid() OR c.user_id IS NULL OR public.is_admin(auth.uid()))
    )
  );

-- --- ORDERS & ORDER ITEMS ---
CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage all orders"
  ON public.orders FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view own order items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

CREATE POLICY "Users can insert order items for own orders"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.user_id = auth.uid() OR auth.uid() IS NOT NULL)
    )
  );

CREATE POLICY "Admins can manage all order items"
  ON public.order_items FOR ALL
  USING (public.is_admin(auth.uid()));

-- --- PAYMENTS ---
CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

CREATE POLICY "Admins can manage payments"
  ON public.payments FOR ALL
  USING (public.is_admin(auth.uid()));

-- --- COUPONS ---
CREATE POLICY "Public can view active coupons"
  ON public.coupons FOR SELECT
  USING (is_active = TRUE OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage coupons"
  ON public.coupons FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view own coupon usage"
  ON public.coupon_usage FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- --- REVIEWS ---
CREATE POLICY "Public can view approved reviews"
  ON public.reviews FOR SELECT
  USING (status = 'approved' OR auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can write reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending reviews"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can manage all reviews"
  ON public.reviews FOR ALL
  USING (public.is_admin(auth.uid()));

-- --- HOMEPAGE SECTIONS & SITE SETTINGS ---
CREATE POLICY "Public can view active homepage sections"
  ON public.homepage_sections FOR SELECT
  USING (is_active = TRUE OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage homepage sections"
  ON public.homepage_sections FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Public can view site settings"
  ON public.site_settings FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins can manage site settings"
  ON public.site_settings FOR ALL
  USING (public.is_admin(auth.uid()));
