-- VK VASTRAM pre-launch cleanup: DESTRUCTIVE
-- Run ONLY after:
-- 1) running ops_prelaunch_cleanup_preview.sql and reviewing every count;
-- 2) taking a Supabase backup/export;
-- 3) confirming there are NO genuine customer orders or live-money payment records to retain;
-- 4) exporting product image storage_path values so Storage files can be reviewed separately.
--
-- This preserves all tables/schema, auth users and profiles, addresses, categories, collections,
-- homepage_sections, site_settings (including general settings/colors/saree type configuration),
-- admin_push_subscriptions, carts, and order-number sequence state.
--
-- Delete effects by FK cascade:
-- - products -> product_images, product_variants, inventory_movements, reviews,
--   back_in_stock_subscriptions and cart_items for those variants.
-- - orders -> order_items, payments, order_history and coupon_usage for those orders.
-- - coupons -> any remaining coupon_usage rows.
-- - payment_webhook_events is cleared because this is a pre-launch test-data reset; it does not
--   change Razorpay settings or webhook configuration.
--
-- Actual files in Supabase Storage are NOT deleted by this SQL. Use Supabase Storage UI/API to
-- remove only the reviewed object paths belonging to product images. Do NOT delete the whole bucket.

BEGIN;

DELETE FROM public.orders;
DELETE FROM public.products;
DELETE FROM public.coupons;
DO $$
BEGIN
  -- This table was added by the Razorpay layer migration; skip only if the deployment is behind.
  IF to_regclass('public.payment_webhook_events') IS NOT NULL THEN
    DELETE FROM public.payment_webhook_events;
  END IF;
END $$;

COMMIT;

-- Post-cleanup counts (run separately after COMMIT if your SQL editor executes one statement at a time):
-- SELECT 'products' AS dataset, COUNT(*) FROM public.products
-- UNION ALL SELECT 'product_variants', COUNT(*) FROM public.product_variants
-- UNION ALL SELECT 'product_images_rows', COUNT(*) FROM public.product_images
-- UNION ALL SELECT 'orders', COUNT(*) FROM public.orders
-- UNION ALL SELECT 'payments', COUNT(*) FROM public.payments
-- UNION ALL SELECT 'coupons', COUNT(*) FROM public.coupons;
