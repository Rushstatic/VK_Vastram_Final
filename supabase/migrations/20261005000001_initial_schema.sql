-- =====================================================================
-- VK VASTRAM SUPABASE PRODUCTION DATABASE SCHEMA
-- Migration: 20261005000001_initial_schema.sql
-- =====================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 1. ENUMS AND DOMAINS
-- =====================================================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('customer', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE product_status AS ENUM ('draft', 'active', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE cart_status AS ENUM ('active', 'converted', 'abandoned');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'authorized', 'captured', 'failed', 'refunded');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE inventory_movement_type AS ENUM ('purchase', 'sale', 'return', 'damage', 'adjustment', 'reservation', 'release');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE discount_type AS ENUM ('percentage', 'fixed_amount');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE address_label AS ENUM ('Home', 'Work', 'Other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================================
-- 2. HELPER FUNCTIONS & TRIGGERS
-- =====================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Sequence for human-readable order numbers (e.g. VKV-2026-1001)
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1001;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'VKV-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 3. USER PROFILES & ADDRESSES
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  city TEXT,
  pincode TEXT,
  role user_role NOT NULL DEFAULT 'customer',
  loyalty_coins INT NOT NULL DEFAULT 0 CHECK (loyalty_coins >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label address_label NOT NULL DEFAULT 'Home',
  recipient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT,
  landmark TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: automatic profile creation on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    'customer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- 4. CATEGORIES & COLLECTIONS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  banner_image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 5. PRODUCTS & TAXONOMY
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_description TEXT,
  description TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  collection_id UUID REFERENCES public.collections(id) ON DELETE SET NULL,
  sku TEXT UNIQUE,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  mrp NUMERIC(10,2) CHECK (mrp IS NULL OR mrp >= price),
  discount_percentage NUMERIC(5,2) DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  status product_status NOT NULL DEFAULT 'draft',
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  bestseller BOOLEAN NOT NULL DEFAULT FALSE,
  new_arrival BOOLEAN NOT NULL DEFAULT FALSE,
  fabric TEXT,
  weave TEXT,
  origin TEXT,
  dimensions TEXT,
  care_instructions TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 6. PRODUCT IMAGES
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  storage_path TEXT,
  alt_text TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 7. PRODUCT VARIANTS & INVENTORY ARCHITECTURE
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE,
  variant_name TEXT NOT NULL,
  color TEXT,
  size TEXT,
  bed_size TEXT,
  dimensions TEXT,
  price_override NUMERIC(10,2) CHECK (price_override IS NULL OR price_override >= 0),
  mrp_override NUMERIC(10,2) CHECK (mrp_override IS NULL OR mrp_override >= 0),
  stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  reserved_quantity INT NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  attributes JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  movement_type inventory_movement_type NOT NULL,
  quantity INT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 8. CARTS & CART ITEMS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status cart_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cart_id, product_variant_id)
);

-- =====================================================================
-- 9. ORDERS & ORDER ITEMS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT NOT NULL UNIQUE DEFAULT generate_order_number(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  shipping_address_snapshot JSONB NOT NULL,
  billing_address_snapshot JSONB,
  subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  shipping_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (shipping_amount >= 0),
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  payment_status payment_status NOT NULL DEFAULT 'pending',
  order_status order_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name_snapshot TEXT NOT NULL,
  sku_snapshot TEXT NOT NULL,
  price_snapshot NUMERIC(10,2) NOT NULL CHECK (price_snapshot >= 0),
  quantity INT NOT NULL CHECK (quantity > 0),
  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  product_metadata_snapshot JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 10. PAYMENTS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- e.g. 'razorpay', 'cod', 'manual'
  provider_order_id TEXT,
  provider_payment_id TEXT,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status payment_status NOT NULL DEFAULT 'pending',
  method TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 11. COUPONS & REVIEWS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type discount_type NOT NULL DEFAULT 'percentage',
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  minimum_order_value NUMERIC(10,2) DEFAULT 0 CHECK (minimum_order_value >= 0),
  maximum_discount NUMERIC(10,2) CHECK (maximum_discount IS NULL OR maximum_discount >= 0),
  usage_limit INT CHECK (usage_limit IS NULL OR usage_limit > 0),
  per_user_limit INT DEFAULT 1 CHECK (per_user_limit > 0),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.coupon_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  body TEXT,
  status review_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 12. CMS & SITE SETTINGS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.homepage_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_type TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  content JSONB DEFAULT '{}'::JSONB,
  image_url TEXT,
  mobile_image_url TEXT,
  button_text TEXT,
  button_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 13. ATTACH AUTO UPDATED_AT TRIGGERS
-- =====================================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'profiles', 'addresses', 'categories', 'collections', 'products',
        'product_variants', 'carts', 'cart_items', 'orders', 'payments',
        'coupons', 'reviews', 'homepage_sections', 'site_settings'
      )
  LOOP
    EXECUTE FORMAT('
      DROP TRIGGER IF EXISTS trg_update_timestamp ON public.%I;
      CREATE TRIGGER trg_update_timestamp
        BEFORE UPDATE ON public.%I
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    ', t, t);
  END LOOP;
END $$;
