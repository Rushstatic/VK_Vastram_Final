# VK VASTRAM Master Build — 12 Oct 2026

This archive is based on the uploaded `Zip upload 7.zip` source. Existing checkout/Razorpay, inventory reservation, cancellation safeguards, order security, GST snapshot helper and admin push implementation are retained.

## Email notifications (Resend)
The server already had a server-side Resend REST call for admin order alerts. This build adds explicit HTTP status/error logging so invalid credentials, unverified sender domains, rejected recipients, and API failures are visible in server logs rather than silently swallowed.

Configure server environment variables (never VITE-prefixed):
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (must be an allowed/verified sender in Resend for production)
- `ADMIN_NOTIFICATION_EMAIL`
- `SITE_URL=https://vkvastram.in`

For production sending from `orders@vkvastram.in`, verify `vkvastram.in` in Resend and add the SPF/DKIM DNS records shown by Resend. Until this is configured, automatic email cannot be verified. The app cannot be tested against your account without credentials. See official Resend Node/Express docs: https://resend.com/express and https://resend.com/nodejs.

## Important validation
- Run `npm ci --include=dev`, `npm run lint`, and `npm run build`.
- The product image editor now supports dragging gallery cards to reorder them; arrow controls remain as accessible alternatives.
- The product import template now includes extra product placeholder columns for GST rate, gallery URLs, image alt text, SEO and merchandising flags. Existing import parser accepts known fields only; columns not mapped by the parser remain informational placeholders until importer mapping is added. Do not assume every added column is currently persisted.
- Customer review image uploads and full Fall & Pico price propagation still require end-to-end validation against the live Supabase schema and checkout RPC. Do not deploy assuming those flows are complete solely because the frontend builds.
- Invoice logo now uses the configured site logo URL and falls back to `/vk-vastram-logo.png`. If the configured logo is blank, place the original uploaded brand logo at `public/vk-vastram-logo.png`.
- GST invoice rows are built by `src/lib/invoiceTax.ts` from saved item metadata snapshots. Historical orders without rate snapshots cannot reconstruct exact product-level rates. Verify seller GSTIN and applicable tax rate with your accountant.

## Known dependency advisory
`xlsx` 0.18.5 currently triggers high-severity npm audit advisories in this lockfile. Do not run `npm audit fix --force`; evaluate a compatible replacement for Excel import/export separately.
