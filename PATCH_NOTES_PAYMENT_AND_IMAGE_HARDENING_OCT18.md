# Payment and Product Image Hardening — 18 Oct 2026

## Payment findings
- The observed browser error is a failed network load of Razorpay's official checkout SDK. Application code cannot force a remote CDN/network connection to succeed.
- Previously, SDK load/constructor failure flowed through the same `onError` callback as an actual gateway `payment.failed` event, incorrectly attempting to persist a failed payment when checkout never opened. SDK initialization failures now preserve the existing order as pending and show a retryable message.
- Failed script tags are removed so a later retry can load the SDK again.
- The failure endpoint now handles a deployment missing the optional `payments.error_reason` migration and confirms idempotent status updates; successful/captured payment states are not downgraded.

## Image viewer hardening
- Removed CSS visibility gating that could leave the viewer image hidden if image load state raced.
- Viewer now keys its loading indicator to the resolved active URL and exposes image-unavailable state accessibly.
- If the database contains a broken/private URL or the host blocks hotlinking, source data still must be corrected (prefer public Supabase Storage URLs).

## Required production checks
1. Ensure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are from the same mode (both Test or both Live). Never expose the secret in Vite variables.
2. Verify `https://checkout.razorpay.com/v1/checkout.js` loads in the actual client network/browser. `ERR_CONNECTION_CLOSED` may be caused by network filtering, extensions, proxy, or CDN connectivity; this code patch cannot override those conditions.
3. Test in Razorpay Test Mode before Live Mode, including payment success, gateway-declined payment, closing the modal, and SDK blocked/offline.
4. Verify webhook configuration and check the payment row/order status after each test. Do not clear or recreate an order solely because SDK initialization failed.
5. Test product detail and fullscreen image URLs in the browser Network panel.
