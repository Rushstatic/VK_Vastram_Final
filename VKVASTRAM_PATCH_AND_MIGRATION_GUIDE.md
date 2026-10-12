# VK VASTRAM — Updated Fixes and Deployment Guide

This archive contains updated source code and a forward-only Supabase migration. It does **not** deploy the code or change the live database automatically.

## Fixes in this revision

- **Fullscreen and product images:** normalize common relative Supabase Storage paths, resolve legacy image sources from `storage_path`, avoid empty gallery slides, handle cached-image load state safely, show a visible error if an image fails or stalls, and delay secondary gallery thumbnails by 1.5 seconds before a restrained grow/turn GSAP entrance. Reduced-motion preferences are respected.
- **Product variants:** remove dependence on the Colour Attribute dropdown; save colour name, primary/secondary HEX values, SKU, stock and variant images; preserve existing variant metadata where new form fields are blank; fail visibly if the existing variants cannot be fetched.
- **Order storage/lifecycle:** add a reconciliation migration for missing order/courier/review/gallery fields and an `order_history` table. The manual lifecycle still requires the enum compatibility migration listed below.
- **Coupons:** remove the per-customer usage cap in the admin form and new-coupon payload. The global coupon `usage_limit` remains available. Existing rows are migrated to `per_user_limit = NULL`.
- **Excel export:** fetches all pages matching the active filters, uses item snapshots included in the order-list response rather than fragile per-order fetches, serializes to an XLSX Blob and falls back to CSV if browser XLSX serialization fails. It keeps the 80-column reference layout and one row per item.
- **GST in invoices:** stores GST-inclusive tax snapshots on each order line without increasing the customer’s payable total; invoice templates display the available rate-wise tax split and the configured GSTIN. Unknown GST rates are not falsely interpreted as 0%—configure each product’s rate before checkout.
- **Back-in-stock requests:** signed-in customers can save a restock request against an out-of-stock variant. The request is stored in Supabase and queued when stock becomes available. Optional email dispatch uses Resend; no email is claimed as sent if store mail configuration is incomplete.

## 1. Back up and reconcile Supabase first

1. Test on a staging Supabase project where possible and take a database backup before production changes.
2. In the project directory, review migration history:

   ```powershell
   npx supabase migration list
   ```

3. If not linked yet, link to the intended project:

   ```powershell
   npx supabase link --project-ref YOUR_SUPABASE_PROJECT_REF
   ```

4. Apply only the migrations that are missing from the remote database, in timestamp order. Relevant migration files in this archive:

   - `202610120001_add_manual_courier_tracking.sql`
   - `202610120002_order_status_enum_compat.sql`
   - `202610120003_manual_lifecycle_cancellation.sql`
   - `202610120004_review_schema_compat.sql`
   - `20261013000001_runtime_schema_reconciliation.sql`

   The `202610120002_order_status_enum_compat.sql` migration is intentionally separate: enum values must be committed before a later migration uses them. Do not merge it into a single explicit SQL transaction with the following migrations.

5. If the migration list shows earlier baseline migrations are missing, review those before pushing anything. Do not force-push, reset production, or blindly replay seed data to make the list appear clean. If `npx supabase db push` stops on an older migration error, stop and inspect the exact failure before proceeding.

6. The Express server must have a valid server-side `SUPABASE_SERVICE_ROLE_KEY` for administrative/order/restock writes. Never put that key in a `VITE_` variable or expose it in browser code.

## 2. Install and verify locally

The archive intentionally excludes `.env`, `node_modules`, and `dist`.

```powershell
npm ci
npm run lint
npm run build
npm audit
```

A parser-based syntax check passed for 100 TypeScript/TSX files in the patching environment. Dependency installation timed out there, so a full TypeScript type-check, Vite build, database migration execution, and browser end-to-end test were **not** certified here. Run the commands above in your existing Windows project before deployment.

## 3. Product variants and gallery

In Admin → Products → edit a product → Stock & Variant Ledger, configure the variant title, SKU, stock, colour name, primary HEX and secondary HEX, then select **Update & Publish**. Re-open the product after saving and confirm each value persists. Gallery records require the product-image/gallery schema; the reconciliation migration adds the expected gallery columns if they are missing.

For remote images, verify each `image_url` or `storage_path` is publicly reachable from a private browser session. If an external Google Drive link is not publicly readable, the website cannot display it; set access appropriately or use a public image URL. The UI now presents a useful error instead of a silent permanent blank state.

## 4. Orders and COD

Use the manual lifecycle in order:

`Pending → Confirmed → Packed → Shipped → Out for Delivery → Delivered`

Before setting **Shipped**, enter and save the local courier/partner name. Tracking ID and URL can be empty for a courier without public tracking. Cancellation remains a distinct workflow; a successful cancellation is not the same thing as a completed Razorpay refund.

For COD, the admin must record delivery/collection based on reliable confirmation from the local courier. Record **COD collected** only when the customer has paid the courier, and **COD settled** after the collected cash is reconciled to the store. The site cannot automatically detect physical cash collection without a courier integration or an explicit confirmation feed.

## 5. GSTIN and tax configuration

1. Open Admin → Settings and enter the store’s verified GSTIN.
2. Edit each applicable product and configure the correct GST rate. Do not assume one rate applies to every saree or textile; have the rate/HSN classification confirmed by your accountant.
3. Create a test order after the migration and product tax-rate configuration. Check GST rows and totals in the customer order confirmation invoice, account invoice, and admin invoice.

Catalog prices are treated as **GST-inclusive** by this patch: tax is extracted into line-item snapshots and is not added again to the payable total. Older orders without rate-wise snapshots show only the tax value that was actually recorded, with a notice that a full rate-wise split is unavailable. Confirm seller legal details, place of supply, HSN/SAC and invoice compliance with your accountant before using generated PDFs/printouts as statutory tax invoices.

## 6. Back-in-stock notification setup

The **Notify me when available** action requires the customer to sign in or create an account. The request is stored under the signed-in customer and selected variant. When inventory moves from unavailable to available, the database marks matching requests ready for dispatch.

For email delivery, configure these server-side environment variables on the deployed Express server:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (a sender/domain verified in Resend)
- `SITE_URL` (for example `https://vkvastram.in`; `APP_URL` is accepted as a fallback)

If these settings are absent, the site reports that the request was saved but email delivery is not configured; it does not claim that an email was sent. Test using a staging product and a mailbox you control.

## 7. Release smoke tests

Before production release, verify:

- Product quick view and fullscreen gallery work on desktop/mobile; valid images load, broken images show a clear fallback, and thumbnail entrance respects reduced-motion settings.
- Creating and editing products persists variant name, SKU, both HEX colours, images and stock after reopening the editor.
- Review requests no longer fail because a compatibility column is missing.
- Admin order list/detail opens without “Order storage is unavailable”; walk an order through all allowed status transitions.
- Cancellation updates the customer-facing order status and inventory exactly once; do not mark an online refund complete unless the provider confirms it.
- Coupon usage is still constrained by the global cap, with no per-customer limit field or enforcement.
- Export several pages of filtered orders and reconcile item rows/totals against the reference workbook.
- Invoices show GSTIN and available tax breakdowns without double-charging tax.
- A signed-in customer can subscribe to a sold-out variant and, with mail settings configured, receives a restock email after stock becomes available.
- Browser console and server logs have no unresolved API/database errors.

## Operational boundary

This is a source-and-migration patch, not a deployment. The updated code, database migrations, and server environment variables must all be deployed/configured for the behavior to become active on `vkvastram.in`. Shiprocket is not integrated; the courier workflow remains manual and uses the same order lifecycle designed for a future integration.
