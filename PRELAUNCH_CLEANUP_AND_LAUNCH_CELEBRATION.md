# VK VASTRAM — Pre-launch reset and one-time launch celebration

## 1. Pre-launch data cleanup

The project includes two SQL scripts under `supabase/ops/`:

- `PRELAUNCH_CLEANUP_PREVIEW.sql` — read-only counts and product-image path inventory. Run this first.
- `PRELAUNCH_CLEANUP_EXECUTE.sql` — destructive reset of product, order, coupon, and payment-webhook test data.

**Do not run the execute script until you have reviewed the preview, taken a Supabase backup/export, and confirmed that all rows being deleted are test data. Never delete real paid orders or financial records just to reset the admin dashboard.**

The cleanup preserves schema/migrations, profiles and auth users, addresses, categories, collections, homepage sections, site settings, and admin push subscriptions. Product rows cascade to variants, product-image metadata, inventory movements, product reviews, back-in-stock subscriptions, and cart items attached to the removed variants. Orders cascade to their items, payment rows, order history and coupon usage. Coupons and leftover coupon usage are removed.

Postgres row deletion does not remove the actual objects stored in Supabase Storage. The preview script lists `product_images.storage_path`; export that list before running the destructive script, then remove only reviewed product-image objects through the Supabase Storage UI/API. **Do not empty the whole `store-assets` bucket**, because it may contain the store logo, campaign banners, or other non-product assets. External image URLs and images bundled in the source repository are not removed by these SQL scripts.

After cleanup, upload the launch catalog and image assets before opening the store to customers. Confirm the product count, variants, image URLs/storage paths, inventory, shipping/tax settings, Razorpay live/test mode and email notifications before accepting live orders.

## 2. One-time official launch celebration

The admin dashboard has a **Preview celebration** control and a separate **Start Official Launch** action. Each preview consumes one of five total celebration uses persisted in Supabase through the atomic `consume_launch_celebration_use()` RPC. Up to four preview rehearsals are allowed, preserving the fifth possible use for the official launch; the official launch then locks all further activations. Apply `supabase/migrations/20261018000001_launch_celebration_preview_limit.sql` before rehearsing. The official action requires confirmation and calls the same atomic RPC with `p_mode = official`. The RPC increments the shared counter and inserts the unique `site_settings` key `launch_celebration` in one transaction; the overlay appears only after the RPC succeeds. The official launch is the reserved fifth possible use and is available once.

The celebration auto-dismisses after about 16 seconds, supports Escape/close, respects `prefers-reduced-motion`, and offers an Open Storefront action. Neither the official marker nor the preview counter is part of the data cleanup script. Avoid removing either setting. To intentionally reset the official launch event or rehearsal counter before launch, do so only deliberately and only after confirming the intended behavior.

The celebration is currently an **admin-triggered ceremony on the dashboard**, not a broadcast overlay for every visitor on the public storefront. This keeps the one-time trigger private and avoids surprise animations for customers.
