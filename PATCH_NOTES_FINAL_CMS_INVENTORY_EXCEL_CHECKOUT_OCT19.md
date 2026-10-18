# VK VASTRAM — Final CMS, Inventory, Excel and Checkout Patch (19 Oct 2026)

## Changes in this patch

- Product export now downloads a complete `Products` sheet and a separate `Variants` sheet, including product metadata, pricing, GST rate, images, SEO, merchandising flags, variant identifiers and physical/reserved/available stock.
- Product form places single-item stock / aggregate variant stock near Product Essentials. Variant creation is at the bottom of the variant section.
- Variant rows now expose only variant name, colour name, colour HEX and stock, plus a remove/archive control. Existing variant rows removed in the editor are archived (`is_active=false`) instead of hard-deleted so order/inventory history remains intact. Variants with reserved stock cannot be removed.
- Excel import no longer falls back to direct client-side database writes if the secure server endpoint fails; it reports the server error instead of silently dropping fields.
- Excel import validates category, collection, managed Saree Type/Fabric, price, status and colour HEX values. Existing single-variant products can have stock reconciled from Excel with an inventory movement audit row and an optimistic stock check; multi-variant stock is not guessed from a single product row.
- Product-card `New` badges no longer appear merely because a product was created in the last 30 days. New Arrivals on the homepage remains the latest four active products, sorted newest-first, and intentionally labels those cards. Elsewhere, the badge follows the admin's explicit New Arrival flag.
- Saree type/fabric realtime channels now use unique channel names per hook instance, preventing Supabase errors caused by multiple components registering callbacks on the same already-subscribed channel.
- Saree Traditions normalizes managed image URLs so stale localhost image links are not requested by the browser.
- Coupon validation codes map to HTTP 409 rather than a generic 503.
- New migration `20261019000001_checkout_discount_tax_coupon_lifecycle.sql` fixes payment/COD stored amounts to include the discount, recalculates GST snapshots proportionally for GST-inclusive discounted lines, excludes abandoned/unpaid online orders from coupon usage-limit counts, and releases coupon-use rows when an unpaid order is cancelled.

## Important tax note

The migration treats product prices as GST-inclusive and allocates a coupon discount proportionally across line items before recalculating the included GST component. This is a consistent implementation of the current code's GST-inclusive pricing model, but the business's accountant must confirm the tax treatment before production migration. Do not apply the migration to production until that approval and a database backup are in place.

## Deployment

1. Back up the production Supabase database.
2. Review and apply `supabase/migrations/20261019000001_checkout_discount_tax_coupon_lifecycle.sql` after the prior migrations, including `20261018000002_atomic_coupon_redemption_and_refund_queue.sql`.
3. Confirm the production admin has permission to read `site_settings`, products, variants, and inventory tables through the authenticated server routes.
4. Test product export with a single-variant and multi-variant product. Confirm the `Products` and `Variants` sheets contain expected stock totals and stable IDs.
5. Test import on a staging/test product: new product, existing single-variant stock adjustment, invalid category/type/fabric/hex, and a multi-variant product (which must be rejected for ambiguous stock import).
6. Test removing an unused variant and a variant with reserved stock. The former should be archived on save; the latter should be blocked.
7. Test checkout with no coupon, a coupon, expired coupon, failed/abandoned online payment, cancelled pending order, captured online payment, and COD. Compare order total, payment amount, invoice discount and GST snapshots.
8. Run `npm ci`, `npm run lint`, `npm run build`, and browser checks before deployment.

## Verification status

TypeScript/TSX transpilation syntax checks passed for all modified TypeScript files. A full dependency install, type-check, Vite build, and live database/browser test could not be completed in this environment because the package registry/SheetJS tarball install timed out. Treat the archive as code-patched but **not production-build-verified** until the listed commands pass locally. The new SQL migration has been reviewed structurally but not executed against a live PostgreSQL/Supabase database.
