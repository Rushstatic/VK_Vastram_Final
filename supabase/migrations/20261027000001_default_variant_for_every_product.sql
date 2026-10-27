-- =====================================================================
-- Every product must have a stock record (a variant row), even a single-item product that never
-- had "Create variant" used. Without it, stock cannot be updated in Inventory.
-- Creates one "Standard" variant for each product that has none. Stock starts at 0 and is set
-- afterwards. Existing variants are not changed. Safe to run more than once.
-- =====================================================================
INSERT INTO public.product_variants (product_id, sku, variant_name, stock_quantity, reserved_quantity, is_active)
SELECT
  p.id,
  -- Unique SKU: product SKU (or id prefix) + "-STD". The UNIQUE constraint on sku prevents duplicates.
  COALESCE(NULLIF(TRIM(p.sku), ''), 'VKV-' || LEFT(p.id::TEXT, 8)) || '-STD',
  CASE WHEN p.category_id IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.categories c WHERE c.id = p.category_id AND LOWER(c.slug) LIKE '%saree%'
       ) THEN 'Standard Free Size' ELSE 'Standard' END,
  0,
  0,
  TRUE
FROM public.products p
WHERE NOT EXISTS (SELECT 1 FROM public.product_variants v WHERE v.product_id = p.id)
ON CONFLICT (sku) DO NOTHING;
