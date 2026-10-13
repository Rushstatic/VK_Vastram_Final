# VK VASTRAM — Priority Checkout Fixes & Render Deployment

## Included in this package

- Shared client shipping calculation using the configured free-shipping threshold and Maharashtra/other-state rates. The cart lets the shopper estimate shipping by state and remembers that estimate for checkout; checkout recalculates from the selected/supplied delivery address.
- Server-side order RPC calculates shipping from the database `site_settings` `general` row, and applies Fall & Pico using the current server-side `fall_pico_price`. Client-sent surcharge amounts are not trusted.
- Guest and authenticated cart metadata persists the Fall & Pico selection. The order item snapshot stores the selection, and Admin Order Details displays it.
- Invoice GST split keeps CGST and SGST on separate rows for intra-state orders, IGST for interstate orders, and explicitly displays residual recorded tax if some legacy line-item snapshots are incomplete. Excel export retains the existing GST columns and flags unknown tax jurisdiction rather than silently guessing.
- Product image stage now has an explicit fullscreen click target and keeps the gallery viewer as the only overlay.
- `tsx` is a production dependency because Render starts the Express server with `tsx server.ts`.

## Required Supabase migrations

Apply these migrations to the linked Supabase project before placing production test orders:

1. `supabase/migrations/20261014000004_shipping_fall_pico_authoritative.sql`
2. `supabase/migrations/20261014000005_cart_item_option_metadata.sql`

They update the order-creation RPC and add the cart item metadata column. Do not manually run only part of either migration.

## Render settings

Use the repository root as the service root.

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Environment: `NODE_ENV=production`

Set production secrets in Render Environment (never commit them):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server only; do not use a `VITE_` prefix)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `SITE_URL` set to the final HTTPS site URL
- Optional notification settings: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_NOTIFICATION_EMAIL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

Do not mark the store production-ready until the database migrations are applied and the live checkout tests below pass.

## Required live acceptance tests

- Maharashtra address, subtotal below threshold: cart estimate and checkout show the Maharashtra rate; saved order `shipping_amount` matches.
- Other-state address, subtotal below threshold: cart estimate and checkout show the other-state rate; saved order matches.
- Subtotal at/above threshold: cart, checkout, and saved order shipping are zero.
- Add the same variant twice with Fall & Pico off/on: the options remain separate; order line price reflects the server-configured surcharge and Admin Order Details shows the selection.
- Verify COD and Razorpay order creation, including an order with Fall & Pico.
- For a configured seller GSTIN, test one same-state and one interstate order. Confirm invoice rows and Excel CGST/SGST/IGST amounts sum to the saved tax amount.
- Click the main product image and each gallery thumbnail; the fullscreen viewer should open the currently selected image and close cleanly.

## Verification status for this archive

The 103 TypeScript/TSX source files pass TypeScript parser syntax checks. A full `npm run lint` / `npm run build` could not be completed in this packaging environment because npm dependency installation did not finish, so those checks must still be run after `npm ci` on Render or locally. The migrations are included but have not been applied to Supabase by this packaging step.


## Follow-up fixes (2026-10-13)

This package adds migration `20261014000006_cart_options_and_tax_component_snapshots.sql`.
Apply it after the previously applied migrations with `npx supabase db push`. It permits separate authenticated cart lines for the same variant with Fall & Pico off/on and adds a database trigger that snapshots CGST/SGST or IGST components into each new order item's metadata. The GST export uses the saved component snapshots when available.

The GST split defaults the seller state code to Maharashtra (`27`) only when the store GSTIN is not configured. This is a business-location assumption, not a substitute for the actual GSTIN. Set the correct GSTIN under Admin Settings before issuing statutory invoices or GST returns. Orders with an unrecognized destination state are deliberately marked unresolved by the database trigger rather than fabricating a split.

The hero campaign now uses a wide desktop image and moves editorial copy below it; the Signature Weave overlay and corresponding Admin Homepage field were removed. The source package should still be validated with `npm ci`, `npm run lint`, and `npm run build` in your Windows project before pushing to GitHub/Render.
