# VK VASTRAM final customer tracking and email patch

## Included
- Merged the provided CMS/logo/favicon/collection/Quick View UI patch into the full security-hardening project.
- Preserved the security-hardening source and the verified SheetJS xlsx 0.20.3 CDN dependency in package.json and package-lock.json.
- Added a premium styled `/track-order` page, linked from desktop/mobile navigation and the Customer Care footer.
- Added `POST /api/orders/track` for order-number + checkout-email lookup. It returns a minimized tracking response, does not expose addresses/payment provider data, and uses the existing `/api/orders` rate-limit family.
- Customer order email is attempted after successful order creation, with order item/totals summary and a direct `/track-order?orderId=...` link. The page pre-fills the order ID; customer enters checkout email.
- Admin email is limited to new-order alerts. Admin status updates no longer send email; existing push notification behavior remains.

## Required Render variables
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (sender domain verified in Resend)
- `ADMIN_NOTIFICATION_EMAIL`
- `SITE_URL=https://vkvastram.in`

## Important limitations / validation
- Email dispatch is best-effort; delivery failure does not roll back an order. Verify Resend domain, sender, and logs with a real test order.
- Customer email currently includes an HTML order/invoice summary (items, subtotal, discount, shipping, tax and total), not a PDF tax-invoice attachment. If a legally formatted downloadable GST invoice is required, wire the existing invoice generator or add a tested server-side PDF renderer before claiming PDF invoice delivery.
- Tracking lookup intentionally uses order number + email as requested. This is low-friction, not strong identity proof; response minimizes data and lookup is rate-limited. A user who knows both values may see basic tracking status.
- No new database migration is included.
- Build/lint could not be run in the packaging environment because dependency installation timed out. Run `npm ci`, `npm run lint`, and `npm run build` locally, then test checkout, email delivery, and tracking in staging before production.


## Resend hosted order-status templates
The server now supports published Resend templates for status emails. Add the relevant template IDs as server-side environment variables:
- `RESEND_TEMPLATE_SHIPPED=<published shipped template ID>`
- `RESEND_TEMPLATE_DELIVERED=<published delivered template ID>`
- `RESEND_TEMPLATE_PACKED=<published packed template ID>` (optional)

When a template ID is set, the server sends that Resend template and passes `CUSTOMER_NAME`, `ORDER_ID`, `TRACKING_NUMBER`, `TRACKING_URL`, `REVIEW_URL`, and `ORDER_URL` as variables. Configure the subject inside each published Resend template. If a template ID is not set, the existing inline HTML email remains the fallback. Never expose the Resend API key in frontend environment variables.
