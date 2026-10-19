# Excel import: optional fields, no mandatory columns (Oct 19)

## Why every row showed "Error"
The import preview (`src/components/admin/AdminImport.tsx`) and the server route
(`POST /api/admin/products/import` in `server.ts`) both treated these as mandatory and rejected the row:
Primary Colour Name, Primary Colour Hex, Primary Image URL, Saree Type, Fabric (must be in the managed list),
Catalog Status (must be exactly active/draft), a price above 0, a valid stock number and a known Category.
A sheet with only name / price / stock / fabric / weave therefore failed all 63 rows.

## New rule
Only the Product Title is required. Everything else is optional:
- Valid cells are saved; blank or invalid cells are left empty (a warning explains what was skipped).
- A NEW product with no price, no image or no recognised category is saved as a DRAFT (never live while incomplete).
- Unknown Saree Type / Fabric are kept as typed and flagged (add them in Admin > Saree Types / Fabrics for filters).
- Invalid HEX codes are dropped; a secondary colour without a valid HEX is skipped.
- localhost / blob: / embedded image URLs are dropped.
- MRP lower than price is ignored. Invalid GST rate = default rate. Blank stock = 0 (new) or unchanged (existing).
- Only these block a row: missing Product Title, or the same SKU twice in one file.

## Existing products (same SKU) are no longer wiped by blank cells
Update now changes only the columns the sheet fills. Blank cells keep the current price, fabric, status, image,
colour and stock. The live URL slug is preserved. Featured / Best Seller / New Arrival are only switched ON.

## Other fixes
- Blank SKU stays blank (the server generates a unique one). Previously the preview invented VKV-SAR-0001...,
  which could match and overwrite an existing product.
- Repeated product names get unique slugs automatically (-2, -3) instead of an error.
- Prices like "₹1,899" are accepted.
- Preview shows: Ready / Imports (notes) / Draft (notes) / Skipped, with a hover list of what was left empty.
- Template INSTRUCTIONS sheet now says which columns are optional.
- Variant colour is saved as "Primary / Secondary" like the product form.

## Files changed
- src/components/admin/AdminImport.tsx
- server.ts (import route only)

## Not run
Type-checked for syntax only in a sandbox without dependencies. Test with 3 rows first
(one complete, one with only a name, one with an existing SKU) before importing all 63.

## Lint fix (found by `npm run lint`)
`AdminProductForm.tsx` line 238 read `p.color`, but `Product` only has `colors` (a list). Now uses `p.colors?.[0]`
as the fallback when the product has no primary colour in its metadata.

## "Product ID and payload are required." when clicking Execute Catalog Import
Cause: in `server.ts`, `POST /api/admin/products/:id` was registered BEFORE `POST /api/admin/products/import`.
Express matches routes in declaration order, so the request to `/import` was handled by the single-product
update route with `id = "import"`, which fails because the body has no `product`. The bulk import code never ran
(this order was already present in the Oct 19 zip, so the Excel import could not succeed even with perfect data).
Fix: the import route now sits above the `:id` route. A scan of all 44 routes found no other shadowed route.

## "Master SKU" column was ignored
The template header is "Master SKU" but the importer only looked for SKU / Product SKU / Item Code / Code, so every
SKU in the sheet was dropped and replaced by an auto-generated one. "Master SKU" is now recognised. All other
template headers were checked against the importer and match.
