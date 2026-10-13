# VK VASTRAM — Mobile, GST and Image Reliability Patch

## Changes in this patch

- Product gallery image components now attempt the saved `storage_path` as a fallback when the legacy `image_url` fails. Product image mapping retains this fallback for both product-level and variant-level gallery images.
- Product detail thumbnail rail scrolls horizontally on small screens, and the product detail content uses smaller mobile padding.
- Order export replaces generic `Tax 1/Tax 2` fields with `Tax Type`, `CGST Rate`, `CGST Amount`, `SGST Rate`, `SGST Amount`, `IGST Rate`, `IGST Amount`, and `Seller GSTIN`.
- Exported line-item tax amount uses immutable item tax snapshot when available; otherwise it allocates the recorded order tax proportionally across line item values. In the latter case, the GST rates remain blank rather than being invented.
- Invoice tax rendering splits recorded order tax into CGST + SGST for a verified same-state destination or IGST for a verified interstate destination when legacy orders do not have per-item tax snapshots. It clearly marks rates as unavailable for those legacy orders.
- GST state matching handles Maharashtra aliases such as `MH`, `Maharashtra`, and GST state code `27`.
- Removed the public footer's Merchant Administration CMS link and routed `/admin` to the admin login page. Existing `/admin/...` routes remain supported.

## Important GST limitation

Older orders may not contain item-level GST-rate/tax snapshots. For those orders, the invoice/export can only split the recorded order tax amount by place of supply; it cannot truthfully reconstruct the original rate per item. Rates are therefore left blank and the invoice labels the limitation. For future statutory-grade invoices, ensure checkout snapshots the configured product GST rate, taxable value and tax amount on each order line. Confirm applicable HSN/SAC and rates with the business's tax professional.

The tax type depends on the first two digits of the seller GSTIN and the destination state. Configure a valid seller GSTIN in Store Settings. If either side's state cannot be resolved, the export leaves Tax Type blank and the invoice avoids guessing.

## Supabase

No new database migration is included in this patch. It uses the existing `product_images.storage_path`, order tax totals, and Store Settings GSTIN. The fallback only helps when `storage_path` is itself a valid publicly accessible path; it cannot make a private/missing file public or repair a nonexistent object. Verify the actual failing image URL and bucket policy if images still fail after deployment.

## Validation

Static assertions confirmed the expected export headers, `/admin` route, removal of the public CMS link, and fallback-image code. A full `npm run lint` / `npm run build` could not be run in this packaging environment because dependency installation did not complete. Run locally after extracting:

```powershell
npm ci
npm run lint
npm run build
```

Then test on staging, especially product/variant image paths, order export for both Maharashtra and non-Maharashtra addresses, GSTIN on invoices, and mobile viewport widths around 360–430 px.
