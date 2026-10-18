-- VK VASTRAM pre-launch cleanup: READ-ONLY PREVIEW
-- Run this first in Supabase SQL Editor. It does not delete or update anything.
-- Inspect the counts and export the product image paths before running the separate cleanup script.

SELECT 'products' AS dataset, COUNT(*)::bigint AS rows FROM public.products
UNION ALL SELECT 'product_variants', COUNT(*)::bigint FROM public.product_variants
UNION ALL SELECT 'product_images_rows', COUNT(*)::bigint FROM public.product_images
UNION ALL SELECT 'inventory_movements', COUNT(*)::bigint FROM public.inventory_movements
UNION ALL SELECT 'reviews', COUNT(*)::bigint FROM public.reviews
UNION ALL SELECT 'orders', COUNT(*)::bigint FROM public.orders
UNION ALL SELECT 'order_items', COUNT(*)::bigint FROM public.order_items
UNION ALL SELECT 'payments', COUNT(*)::bigint FROM public.payments
UNION ALL SELECT 'coupons', COUNT(*)::bigint FROM public.coupons
UNION ALL SELECT 'coupon_usage', COUNT(*)::bigint FROM public.coupon_usage
UNION ALL SELECT 'cart_items', COUNT(*)::bigint FROM public.cart_items
UNION ALL SELECT 'carts_preserved', COUNT(*)::bigint FROM public.carts
UNION ALL SELECT 'profiles_preserved', COUNT(*)::bigint FROM public.profiles
UNION ALL SELECT 'categories_preserved', COUNT(*)::bigint FROM public.categories
UNION ALL SELECT 'collections_preserved', COUNT(*)::bigint FROM public.collections
UNION ALL SELECT 'homepage_sections_preserved', COUNT(*)::bigint FROM public.homepage_sections
UNION ALL SELECT 'site_settings_preserved', COUNT(*)::bigint FROM public.site_settings
ORDER BY dataset;

-- Export/review this result before deleting the product rows.
-- These are storage object paths referenced by product image rows; external URLs may not have storage_path.
SELECT DISTINCT storage_path
FROM public.product_images
WHERE storage_path IS NOT NULL AND BTRIM(storage_path) <> ''
ORDER BY storage_path;

-- Reference audit: image URLs/paths and product links which may require separate Storage API cleanup.
SELECT id, product_id, variant_id, image_url, storage_path, is_primary
FROM public.product_images
ORDER BY product_id, sort_order, created_at;


-- Review records before deletion; counts alone are not sufficient proof that data is test-only.
SELECT id, order_number, order_status, payment_status, total_amount, currency, created_at
FROM public.orders
ORDER BY created_at DESC;

SELECT id, sku, name, status, price, created_at
FROM public.products
ORDER BY created_at DESC;

SELECT id, code, is_active, starts_at, expires_at, usage_limit
FROM public.coupons
ORDER BY code;
