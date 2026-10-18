# VK VASTRAM — Variant Image / Cart Consistency Fix (2026-10-17)

## Root cause
- Product-card swatch selection changed the displayed variant, but the card's Add to Bag callback passed only the product object. The app then chose a variant independently, while the cart defaulted the visible color label to the first product color.
- The authenticated-cart query selected only generic product images and ignored `product_images.variant_id`, so it could show a different variant's thumbnail.
- Some gallery fallback paths could use any image when the selected variant had no image, allowing another color's photo to leak into the current selection.

## Fixes
- Product cards now pass the selected variant ID, color, and size through ProductGrid, collection rails, wishlist, and complementary/recently-viewed rails.
- The resolved variant ID is the source of truth for cart color and image, preventing label/SKU drift.
- Guest cart rows snapshot the selected variant image. Older guest-cart rows resolve their thumbnail by variant ID as a compatibility fallback.
- Existing guest carts are automatically reconciled when their stored variant ID, selected SKU, and color disagree. The chosen variant SKU/color is aligned to the cart row, and its thumbnail is refreshed when the cart is loaded.
- Authenticated cart loading resolves the variant's own `product_images` rows first, then attribute images, then genuinely shared product-level images. It never picks an image assigned to a different variant.
- Cart drawer, cart page, and checkout all use the same variant-aware image resolver.
- Product detail and quick-view galleries no longer use another variant's gallery as a fallback.
- Product-service variant galleries no longer fall back to the complete mixed product gallery when no shared product-level images exist.
- Added a regression script: `scripts/test_cart_variant_image_resolution.ts`.

## Validation
- Run `npm run build` and `npm run lint` after installing dependencies.
- Run `npx tsx scripts/test_cart_variant_image_resolution.ts`.
- On staging, verify both guest and authenticated carts: select Mogambo (SKU ending `307-01`) and Saoda (SKU ending `307-02`) in turn. Each must show its own matching image and label in the drawer, full cart, and checkout summary. Refresh/reopen the cart to verify persistence.
- If the selected variant has no variant-specific image and no shared product image, the UI intentionally displays a neutral placeholder rather than another variant's photo.
