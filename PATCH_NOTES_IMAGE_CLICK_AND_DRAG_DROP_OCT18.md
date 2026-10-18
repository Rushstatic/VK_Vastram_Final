# VK VASTRAM — Product image click and drag-and-drop upload update

## Product image navigation
Clicking/tapping a product card image/title now opens Product Detail on the first interaction; the previous flip-first interaction has been removed. Quick View, Add to Bag, Wishlist and swatches remain separate controls. This fixes the interaction conflict, but it cannot fix a broken/unavailable image URL.

## Product gallery drag-and-drop
The Admin Product Form image uploader now supports dropping multiple JPEG, PNG, or WebP files into the upload zone, as well as using the file picker. Both use the same existing adminService upload/optimization flow and inherit the selected variant assignment and image role. Source files over 20 MB are rejected with an error. Existing gallery reorder drag-and-drop remains separate.

## Launch celebration
The `LaunchCelebrationOverlay` and admin dashboard integration are retained. All celebration activations are capped at five uses across admin sessions through an atomic Supabase RPC; up to four may be rehearsals, preserving the fifth potential use for the official launch. Apply `supabase/migrations/20261018000001_launch_celebration_preview_limit.sql` before previewing. The official celebration remains a separate one-time admin-triggered action; this is not a public storefront-wide broadcast.

## Verification
Run `npm ci`, `npm run build`, `npm run lint`, and `npx tsx scripts/test_cart_variant_image_resolution.ts`. Test dropping one and several images, unsupported files, oversized files, variant association, save/reopen of the product, and product image clicks on desktop and mobile before deployment.
