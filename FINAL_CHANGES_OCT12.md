# VK VASTRAM — Final Changes in This Patch (12 Oct 2026)

## Applied in source
- Fixed React Rules-of-Hooks violation in `ProductDetailPage`: `useSiteSettings` and the colors memo now run before the product-not-found conditional return. This addresses the blank product detail screen / “Rendered more hooks than during the previous render” runtime error shown in the supplied screenshot.
- Added admin General Settings fields for Fall & Pico base price, Maharashtra shipping charge (default ₹100), and other-state shipping charge (default ₹150). These are stored in the existing `site_settings` general JSON object.
- Site settings service now reads the new values with backward-compatible defaults.
- Admin order Excel export now includes courier, tracking, fulfillment, shipping location, net-after-discount and COD collection status columns in addition to the existing financial/order fields.
- Manual courier tracking form now accepts a blank tracking URL (for local courier partners) and validates a URL only when provided.

## Existing behavior / deployment requirements
- Apply the courier migration already included at `supabase/migrations/202610120001_add_manual_courier_tracking.sql` before using courier fields.
- The shipping values in settings are configuration fields; they are not by themselves proof that checkout/server-authoritative order totals use the ₹100/₹150 rule. Verify and complete that pricing integration before taking live orders.
- Fall & Pico settings now have an admin entry point, but the service charge has NOT been fully wired through cart, server-authoritative checkout pricing, persisted order items, and invoice. Do not charge customers for it until that full integration is completed and tested.
- Cancellation of an order already converted to a completed inventory sale still needs a dedicated transactional cancellation/refund/restock database workflow. Do not bypass the existing reservation guard or manually mark a paid order cancelled without reconciling payment and stock.
- Excel export uses the current page of loaded orders; use filters/pages as needed. It does not yet reproduce every Shopify-template column where the source system has no matching data.

## Verification
- Archive integrity should be checked with `unzip -t`.
- Run `npm ci`, `npm run lint`, and `npm run build` in the user's Windows environment. Dependency installation timed out in this isolated build environment, so this patch does not claim a fresh lint/build pass here.
