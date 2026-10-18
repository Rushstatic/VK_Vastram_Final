# VK VASTRAM — Homepage, Taxonomy and Import Fixes (18 Oct 2026)

## Homepage catalogue correctness
- `productService.getProducts()` now preserves `products.created_at` as `createdAt`.
- New Arrivals is sorted newest-first from the database timestamp and displays the latest four active products; these cards receive a pulsing **New** label.
- Curated Heritage Sarees now shows only active sarees explicitly marked `Featured` in Admin. It no longer uses every saree as a fallback for the curated editorial row. Mark the intended products as Featured in Admin.
- Sale and New labels can display together rather than Sale hiding the New marker.

## Saree types and filters
- Added a shared `useSareeTypes()` hook used by the Header and Saree Traditions section. It refreshes from `site_settings.saree_types`, the realtime channel, focus/storage events, and the `vk_saree_types_updated` event.
- Removed hardcoded duplicate saree-type navigation destinations; navigation now uses the managed type name.
- `subCategory` is now derived only from managed `metadata.sareeType`, not arbitrary free-text weave values.
- Collection filters now use the managed active Saree Type list and exact Fabric matching, without the former eight-fabric limit.

## Managed fabrics
- Added a Fabrics tab to Admin > Saree Attributes (the existing Saree Types menu entry). It supports active/inactive values, duplicate-name checks, product usage counts, and discourages deleting in-use fabrics.
- Added a shared managed-fabric hook and changed the product form's Fabric Composition input to a managed dropdown with a legacy option for existing product values.
- Added migration `supabase/migrations/20261018000003_managed_fabric_types_public_read.sql` to allow public reads of the `fabric_types` setting only. Writes remain subject to existing admin policies.

## Product form and import
- Selling price visually starts blank and requires a positive amount for active products.
- Saree colour is entered in one primary colour block, with the secondary name/hex fields shown only after enabling the secondary-colour toggle. Active sarees require a valid primary `#RRGGBB` hex value.
- Slug uniqueness is checked before saving a product.
- Reworked the downloadable import workbook to have product-form-aligned columns plus `INSTRUCTIONS` and live-data `LISTS` sheets; includes a clearly fake row that the importer skips.
- Import parsing now handles the added metadata columns (slug, saree type, colour hexes, extra images, SEO, featured/bestseller/new-arrival, tags), validates duplicate workbook SKUs/slugs and known managed type/fabric values, and forwards those fields to the server import endpoint.
- Server-side bulk import now persists featured/bestseller/new-arrival, SEO, managed saree type and colour metadata, tags, and additional image URLs.

## Important deployment notes
1. Back up Supabase before any migration.
2. Apply `20261018000003_managed_fabric_types_public_read.sql` in the production Supabase SQL editor, after reviewing it.
3. In Admin > Saree Attributes, review/curate active Saree Types and Fabrics. Existing product values marked `(legacy)` should be mapped to a managed value before expecting them in filters.
4. Mark the desired sarees as **Featured** to populate Curated Heritage Sarees. New Arrivals is based on the newest four active products by database creation timestamp.
5. Rehearse the Excel import on a test product before importing the real catalogue.

## Verification status
- TypeScript/TSX syntax transpilation passed for all modified application files.
- A full `npm ci`, `npm run lint`, `npm run build`, and runtime/browser test could not be completed in this environment because the lockfile's SheetJS tarball (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) was not available in the local npm cache and the install did not complete. Run the commands locally before deploying; do not treat this ZIP as production-build-verified.
