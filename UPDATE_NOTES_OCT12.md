# VK VASTRAM — Update Notes (Oct 12, 2026)

This archive is based on the latest source ZIP supplied in this conversation.

## Changes included
- Added Excel export for the currently loaded order page. Export includes order identifiers, customer details, subtotal, discount, coupon code, shipping/tax values when supplied by the API, net total, payment method/status, order status, and tracking number when supplied.
- Added Excel export for the currently loaded product list.
- Added Excel export for the inventory ledger.
- Added Excel export for coupons and a separate coupon usage history worksheet.
- Mounted the existing `AdminSareeTypes` component in the admin layout so the Saree Types navigation item renders its page.
- Removed the rigid gold-embossed gift-box selection from the saree product detail page.
- Removed prefilled admin login credentials from the login form.

## Verification status
- `package.json` and lockfiles are included; `xlsx` was already a declared dependency.
- I attempted `npm ci` in this environment, but dependency installation timed out, so I could not run `npm run lint` or `npm run build` against this archive here. Please run those two commands locally before deploying.

## Important scope note
This is a focused update, not the full operations release. GST place-of-supply invoice logic, admin invoice download, paid/server-validated Fall & Pico pricing, courier/AWB persistence, cancellation workflow verification, free-shipping threshold messaging, and the image-viewer/auth-refresh runtime tests still require implementation and end-to-end verification before the project should be called production-ready. Existing payment, coupon, and inventory backend logic was not intentionally changed by this patch.
