-- =====================================================================
-- VK VASTRAM MIGRATION: 20261005000012_variant_product_images_and_gallery.sql
-- Variant-Specific Product Images, Roles, and Presentation System
-- =====================================================================

-- 1. Add variant association, role, and presentation columns to product_images
ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'gallery',
  ADD COLUMN IF NOT EXISTS fit TEXT DEFAULT 'cover',
  ADD COLUMN IF NOT EXISTS focal_x INT DEFAULT 50,
  ADD COLUMN IF NOT EXISTS focal_y INT DEFAULT 50,
  ADD COLUMN IF NOT EXISTS scale NUMERIC(3,2) DEFAULT 1.0;

-- 2. Add performance indexes for gallery and variant queries
CREATE INDEX IF NOT EXISTS idx_product_images_product_variant
  ON public.product_images(product_id, variant_id);

CREATE INDEX IF NOT EXISTS idx_product_images_product_sort
  ON public.product_images(product_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_product_images_role
  ON public.product_images(role);

-- 3. Seed "Kerala Tissue Silk Saree" with Lavender and Gold variants
-- Product UUID: c0000000-0000-0000-0000-000000000009
INSERT INTO public.products (
  id, slug, name, short_description, description, category_id, collection_id, sku,
  price, mrp, discount_percentage, status, featured, bestseller, new_arrival,
  fabric, weave, origin, dimensions, care_instructions, seo_title, seo_description
)
VALUES
  (
    'c0000000-0000-0000-0000-000000000009',
    'kerala-tissue-silk-saree',
    'Kerala Tissue Silk Saree',
    'Ethereal metallic sheen handwoven with pure zari warp and fine silk weft.',
    'A luminous Kerala Tissue Silk drape crafted with ancestral precision. Known for its subtle metallic sheen, crisp hand, and gilded borders, this saree embodies timeless South Indian ceremonial elegance.',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'VK-SAR-KER-009',
    16800.00,
    19500.00,
    13.85,
    'active',
    TRUE,
    TRUE,
    TRUE,
    'Pure Silk & Metallic Tissue Zari',
    'Traditional Kerala Handloom Weave',
    'Balaramapuram, Kerala',
    '5.5 meters saree + 0.8m unstitched contrast blouse piece',
    'Dry clean only. Store folded in breathable cotton muslin.',
    'Kerala Tissue Silk Saree | VK VASTRAM',
    'Authentic handwoven Kerala Tissue Silk Saree with pure zari borders in Lavender and Gold hues.'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 4. Seed Variants: Lavender and Gold
-- Variant Lavender: e0000000-0000-0000-0000-000000000011
-- Variant Gold:     e0000000-0000-0000-0000-000000000012
INSERT INTO public.product_variants (
  id, product_id, sku, variant_name, color, size, dimensions,
  stock_quantity, reserved_quantity, is_active, attributes
)
VALUES
  (
    'e0000000-0000-0000-0000-000000000011',
    'c0000000-0000-0000-0000-000000000009',
    'VK-SAR-KER-009-LAV',
    'Lavender Tissue',
    'Lavender',
    'Standard 5.5m + 0.8m Blouse',
    '5.5m + 0.8m',
    8,
    0,
    TRUE,
    '{"colorHexPrimary": "#B39DDB", "colorHexSecondary": "#D1C4E9"}'::JSONB
  ),
  (
    'e0000000-0000-0000-0000-000000000012',
    'c0000000-0000-0000-0000-000000000009',
    'VK-SAR-KER-009-GLD',
    'Gilded Champagne Gold',
    'Gold',
    'Standard 5.5m + 0.8m Blouse',
    '5.5m + 0.8m',
    6,
    0,
    TRUE,
    '{"colorHexPrimary": "#D4AF37", "colorHexSecondary": "#F5E084"}'::JSONB
  )
ON CONFLICT (id) DO UPDATE SET
  variant_name = EXCLUDED.variant_name,
  color = EXCLUDED.color,
  attributes = EXCLUDED.attributes;

-- 5. Seed Variant-Specific Images for Lavender
-- Images: Primary/Hero, Full Saree, Pallu, Border, Texture
INSERT INTO public.product_images (
  id, product_id, variant_id, image_url, alt_text, sort_order, is_primary, role, fit, focal_x, focal_y, scale
)
VALUES
  (
    'd0000000-0000-0000-0000-000000000021',
    'c0000000-0000-0000-0000-000000000009',
    'e0000000-0000-0000-0000-000000000011',
    '/src/assets/images/product_chanderi_saree_1791192155766.jpg',
    'Kerala Tissue Silk Saree - Lavender Hero Drape',
    1,
    TRUE,
    'hero',
    'cover',
    50,
    50,
    1.00
  ),
  (
    'd0000000-0000-0000-0000-000000000022',
    'c0000000-0000-0000-0000-000000000009',
    'e0000000-0000-0000-0000-000000000011',
    '/src/assets/images/craft_textile_detail_1791192181572.jpg',
    'Kerala Tissue Silk Saree - Lavender Full Saree View',
    2,
    FALSE,
    'full_saree',
    'cover',
    50,
    50,
    1.00
  ),
  (
    'd0000000-0000-0000-0000-000000000023',
    'c0000000-0000-0000-0000-000000000009',
    'e0000000-0000-0000-0000-000000000011',
    '/src/assets/images/product_banarasi_saree_1791192143761.jpg',
    'Kerala Tissue Silk Saree - Lavender Pallu Detail',
    3,
    FALSE,
    'pallu',
    'cover',
    50,
    50,
    1.00
  ),
  (
    'd0000000-0000-0000-0000-000000000024',
    'c0000000-0000-0000-0000-000000000009',
    'e0000000-0000-0000-0000-000000000011',
    '/src/assets/images/hero_vastram_saree_1791192126882.jpg',
    'Kerala Tissue Silk Saree - Lavender Zari Border',
    4,
    FALSE,
    'border',
    'cover',
    50,
    50,
    1.00
  ),
  (
    'd0000000-0000-0000-0000-000000000025',
    'c0000000-0000-0000-0000-000000000009',
    'e0000000-0000-0000-0000-000000000011',
    '/src/assets/images/craft_textile_detail_1791192181572.jpg',
    'Kerala Tissue Silk Saree - Lavender Weave Texture',
    5,
    FALSE,
    'texture',
    'cover',
    50,
    50,
    1.00
  )
ON CONFLICT (id) DO UPDATE SET
  image_url = EXCLUDED.image_url,
  role = EXCLUDED.role,
  variant_id = EXCLUDED.variant_id;

-- 6. Seed Variant-Specific Images for Gold
-- Images: Primary/Hero, Full Saree, Pallu, Border
INSERT INTO public.product_images (
  id, product_id, variant_id, image_url, alt_text, sort_order, is_primary, role, fit, focal_x, focal_y, scale
)
VALUES
  (
    'd0000000-0000-0000-0000-000000000026',
    'c0000000-0000-0000-0000-000000000009',
    'e0000000-0000-0000-0000-000000000012',
    '/src/assets/images/hero_vastram_saree_1791192126882.jpg',
    'Kerala Tissue Silk Saree - Gold Hero Drape',
    1,
    TRUE,
    'hero',
    'cover',
    50,
    50,
    1.00
  ),
  (
    'd0000000-0000-0000-0000-000000000027',
    'c0000000-0000-0000-0000-000000000009',
    'e0000000-0000-0000-0000-000000000012',
    '/src/assets/images/product_banarasi_saree_1791192143761.jpg',
    'Kerala Tissue Silk Saree - Gold Full Saree View',
    2,
    FALSE,
    'full_saree',
    'cover',
    50,
    50,
    1.00
  ),
  (
    'd0000000-0000-0000-0000-000000000028',
    'c0000000-0000-0000-0000-000000000009',
    'e0000000-0000-0000-0000-000000000012',
    '/src/assets/images/craft_textile_detail_1791192181572.jpg',
    'Kerala Tissue Silk Saree - Gold Pallu View',
    3,
    FALSE,
    'pallu',
    'cover',
    50,
    50,
    1.00
  ),
  (
    'd0000000-0000-0000-0000-000000000029',
    'c0000000-0000-0000-0000-000000000009',
    'e0000000-0000-0000-0000-000000000012',
    '/src/assets/images/product_chanderi_saree_1791192155766.jpg',
    'Kerala Tissue Silk Saree - Gold Border Detail',
    4,
    FALSE,
    'border',
    'cover',
    50,
    50,
    1.00
  )
ON CONFLICT (id) DO UPDATE SET
  image_url = EXCLUDED.image_url,
  role = EXCLUDED.role,
  variant_id = EXCLUDED.variant_id;
