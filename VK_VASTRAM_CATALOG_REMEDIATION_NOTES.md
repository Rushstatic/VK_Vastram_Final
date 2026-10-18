# VK VASTRAM catalogue remediation — 18 October 2026

## What changed

- **New Arrivals** now includes only active products whose admin **New Arrival** flag is enabled. It is sorted newest-first by `created_at` (with `updated_at` as a fallback), shows a blinking **NEW** badge, and respects `prefers-reduced-motion`.
- **Curated Heritage Sarees** now includes only active sarees marked **Featured** in the admin. It no longer reuses the first few sarees from the general catalogue. Both homepage rails are hidden when there are no eligible products.
- Product timestamps and merchandising flags are carried from Supabase to storefront product objects.
- Saree Type navigation, traditions and search suggestions now use the shared managed list. Weave/technique text no longer falls back into Saree Type filter options.
- Added a managed **Fabrics** tab next to Saree Types, exact-match fabric filtering, product counts, active/order controls and a public-read allow-list entry for `fabric_types`.
- Consolidated primary/secondary product colour fields; catalogue cards can render a primary or split two-colour swatch. Sarees no longer need fake variant-colour fields.
- The admin product form validates positive selling prices, MRP >= selling price, valid `#RRGGBB` values and unique slugs. It provides managed Saree Type/Fabric selectors with a legacy value option for existing products.
- The import parser now recognises the new form-aligned headers, old aliases, product flags, SEO/tags and additional images; it validates each row instead of silently discarding these fields. The generated workbook contains PRODUCTS, INSTRUCTIONS and LISTS sheets, named ranges, and Excel drop-down list validation for taxonomy/status/GST/boolean values.
- Added an idempotent migration for product-level colour columns and the public-read policy, plus a **read-only** SQL report for existing fabric values and sarees without a managed type.

## Deploy / data steps

1. **Back up Supabase first.** Review the migration `supabase/migrations/20261018000003_managed_product_attributes.sql`, then run it in the Supabase SQL editor (or your normal migration pipeline) before deploying this code. It creates/backfills product colour columns and allows public reads only for the four listed storefront-safe `site_settings` keys.
2. Run the SELECT statements in `supabase/ops/LIST_LEGACY_FABRICS_AND_UNASSIGNED_SAREE_TYPES.sql`. They are read-only. Map the existing distinct fabric values in the admin **Saree Attributes → Fabrics** tab and assign managed Saree Types to the products reported without a type. Do not bulk-promote arbitrary old weave descriptions into types without checking them.
3. Open **Admin → Saree Attributes** and save the active Saree Types and Fabric lists. The new Fabric filter will only show managed fabrics present among the current products.
4. In the product form, turn on **New Arrival** for products intended for the New Arrivals rail. Turn on **Featured** for sarees intended for Curated Heritage Sarees. These are separate flags. Existing products are not automatically marked new or featured, by design.
5. Test one draft and one active product; verify the draft does not show on the storefront, new arrivals are newest-first, only flagged products appear in their respective rails, and each badge/card colour is correct.
6. Download the import template, confirm the PRODUCTS / INSTRUCTIONS / LISTS sheets and dropdowns, import a valid test row, then test invalid price, invalid HEX, unknown Saree Type/Fabric, duplicate slug/SKU and an unedited sample row. The sample row labelled “delete this row” must be skipped.

## Legacy considerations

- The importer still accepts older column-header aliases, but unknown managed Saree Type or Fabric values are errors rather than new taxonomy records.
- Product records with a missing or inactive managed type/fabric may remain in the catalogue, but will not appear as an active managed filter option until mapped/reactivated.
- The migration is idempotent, but always test on a database copy or after a backup before production.

## Verification performed in this delivery

- Parsed TS/TSX sources for syntax diagnostics.
- Reviewed the changed homepage query logic, product mappings, managed lists, importer paths and migration/report files.
- A full `npm run build` could not be confirmed in this environment because package installation failed when the npm/Sherjs package hosts returned DNS errors. Run `npm ci` and `npm run build` in a network-enabled environment before production deployment, then complete the browser smoke tests above.
