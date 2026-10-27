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

---
# Mobile fixes (Oct 19): title size, Back navigation, swipe, blank fullscreen viewer

## 1. "VK VASTRAM" title too small on phones
Header.tsx: title was 14px (12px after scrolling). Now 17px (15px scrolled), 20px/18px on phones 400px and wider,
and 15px on very narrow phones (under 360px) so it never collides with the menu and bag icons. Desktop sizes unchanged.

## 2. Back button went to the top of the page / left the product section
Causes (App.tsx): scroll restoration was set to "manual" and every page change scrolled to the top, and nothing
remembered where the user was. Now:
- Each history entry remembers its scroll position when you leave it (handleNavigate saves window.scrollY).
- Back/forward restore that position (retries briefly until the page content has rendered).
- The product page "Back to <category>" link uses the real browser Back when you came from a listing, so the
  listing reopens at the same spot instead of a new page at the top.

## 3. Back while a fullscreen image is open left the whole product page
New src/lib/overlayHistory.ts: opening the fullscreen viewer adds one history entry; the phone/browser Back button
now closes the viewer only (page and scroll position untouched). X button and Escape use the same path.

## 4. Product images could not be swiped
- ProductGallery.tsx: swipe left/right on the main image changes the photo (vertical drags still scroll the page; a swipe
  no longer also opens the fullscreen viewer). Mobile dots show the position.
- MobileImageViewer.tsx: horizontal swipe is now ignored for vertical drags, and the stage allows horizontal gestures.
- Thumbnails no longer stay hidden for 1.5 s and no longer re-hide whenever the product object refreshes.

## 5. Blank dark fullscreen viewer (root cause of "cannot swipe")
index.css had TWO `pageEnter` animations that both ended with a transform and kept it ("forwards"). A leftover
transform on <main> makes every `position: fixed` overlay inside it relative to the page instead of the screen, so the
viewer's header, image and close button were off-screen. Both now end with `transform: none` and no "forwards".
MobileImageViewer also renders on document.body (createPortal) so no parent can displace it again.

## Files changed in this round
src/index.css, src/App.tsx, src/lib/overlayHistory.ts (new), src/components/common/Header.tsx,
src/components/product/ProductGallery.tsx, src/components/product/MobileImageViewer.tsx,
src/components/pages/ProductDetailPage.tsx

## Not covered
Collection-page filters are component state, so after Back the scroll position returns but any chosen filters reset.
Tested: syntax/scope check and a simulated browser-history test of the Back-closes-viewer logic. Not tested on a device.

---
# Unpaid / abandoned payments: stock, order status, visibility (Oct 19)

## What was wrong
A customer who started online payment and then skipped it left an order "pending" and the saree reserved, so a
1-piece saree showed "Sold out". Causes found:
1. `reconcile_expired_reservations()` existed but NOTHING ever called it (no scheduler, no server code).
2. It ignored orders whose payment_status had become 'failed' (the payment-failure route sets that), so they never expired.
3. Closing the Razorpay popup deliberately kept the order "preserved in pending state" with the stock held.
4. The admin alert and customer email were sent when the order was CREATED, before any payment.
5. Admin Orders list, dashboard counters and the customer's "My orders" treated unpaid checkouts as real orders.

## Rules now (standard e-commerce behaviour)
- Online payment: the item is only RESERVED for a short hold (default 10 min, env `CHECKOUT_HOLD_MINUTES`, 5-30).
  Stock is deducted ONLY when the payment is confirmed (unchanged).
- Customer closes the payment popup: the hold is released immediately and the unpaid order is cancelled with
  payment_status = failed. The bag is untouched; the customer just places the order again.
- Customer just leaves / closes the tab: the server sweeper (every 60 s, also before each new order) and, if available,
  pg_cron (every minute) release the hold after the window (+3 min grace for a delayed payment notification).
- Cash on Delivery: confirmed immediately, stock deducted immediately, never expired.
- A payment that was captured/authorized is never released (database check + Razorpay check on popup close).
  If money arrives after a hold was released, the existing refund-review alert flow handles it.
- Admin alert + customer email: sent when an order is confirmed (COD at creation, online after payment capture).
- Admin Orders: tabs  Confirmed (default) | Awaiting payment | Failed / abandoned payments | All, with counts.
- Dashboard "Orders today" counts confirmed orders only; "Pending Pay" card is now "COD To Collect".
- Customer account: orders list shows confirmed orders; unpaid checkouts appear in a small collapsed
  "Payment not completed" section (no charge was made).

## Files
- supabase/migrations/20261019000002_unpaid_order_expiry_and_visibility.sql   (RUN THIS)
- server.ts: hold minutes, sweeper, /api/payment/abandon, confirmed-only notifications, admin orders `view` filter + counts
- src/services/paymentService.ts, src/components/checkout/CheckoutPage.tsx (release on popup close; expired retry message)
- src/services/adminService.ts, src/components/admin/AdminOrders.tsx, AdminDashboard.tsx
- src/components/account/AccountPage.tsx

## To deploy
1. Back up the database, then run the new migration. It also releases stock for orders that are ALREADY stuck
   (this frees the saree that currently shows "Sold out").
2. Restart the server. On start it logs the hold length and runs the sweeper; a warning appears if the migration is missing.
3. Check: select order_number, order_status, payment_status, reservation_expires_at from orders where order_status='pending';
          select sku, stock_quantity, reserved_quantity from product_variants where reserved_quantity > 0;

## Not run
The SQL was reviewed by reading only (no PostgreSQL in the build sandbox) and the TypeScript was syntax/scope checked only.
Test in Razorpay TEST mode before going live: (a) pay, (b) close the popup, (c) leave the tab and wait 13 minutes,
(d) COD order, (e) two browsers racing for a 1-piece saree.

---
# Coupon on guest checkout failed with SQLSTATE 23514 (fixed in 20261022000001)
Cause: live table coupon_usage has check coupon_usage_customer_identity_check (user_id OR guest_email must be set).
The order function inserted a coupon redemption for guests with user_id NULL and no guest_email.
Fix: the function now stores the guest email (customer_email_for_coupon / customer_email) and rejects a
guest coupon order that has no email with GUEST_EMAIL_REQUIRED. The migration also adds the guest_email
column and the check so a fresh database matches production (they existed only in the live database).
Run 20261022000001_coupon_guest_identity_fix.sql after 20261021000001. Safe to re-run.

---
# Round: sold count, bag drawer, viewer zoom, blinking "View all"

1. Inventory "Sold" / "Total sold" counted every order line, including unpaid, failed and cancelled checkouts
   (28 shown vs 2 real sales). server.ts /api/admin/inventory now counts only order lines whose order is not
   'pending' and not 'cancelled'. Pending online checkouts and cancelled orders are excluded.
2. Bag (CartDrawer) and wishlist drawers: the wrapper had 40px left padding and no clipping, so the panel could
   show past the right edge on phones. Wrapper is now w-screen max-w-md with overflow-hidden.
3. Fullscreen image viewer: pinch to zoom (up to 4x), drag to pan while zoomed, double-tap or double-click to
   zoom to 2.5x / back to 1x, zoom buttons capped at 4x, every new photo opens at 1x. The image no longer gets
   a GSAP transform, which previously conflicted with zoom.
4. "View All Sarees", "View All Bedsheets" and the rail "View Collection" links blink gently (class vk-cta-blink);
   reduced-motion users get a static highlight instead.
Files: server.ts, src/components/product/MobileImageViewer.tsx, src/components/cart/CartDrawer.tsx,
src/components/wishlist/WishlistDrawer.tsx, src/components/catalog/HorizontalProductRail.tsx, src/App.tsx, src/index.css
No database migration in this round.
Not run: TypeScript only syntax/scope checked here; test pinch and drawer on a real phone.

---
# Admin app & order alerts (Oct 22)
- Admin is installable: public/admin.webmanifest (start /admin), icons admin-icon-192/512 (+ maskable).
  AdminLayout injects the manifest and iPhone home-screen tags, so the storefront is not installed as admin.
- Push: service worker vibrates, stays on screen until tapped, and opens the exact order (/admin?order=VKV-...).
  Server push payload now carries the order number in the URL.
- Live alert while the admin page is open: chime + vibration + banner for a new real order (COD or payment captured).
  Uses Supabase Realtime on public.orders. Migration 20261022000002 adds orders to the realtime publication.
- Browsers allow sound only after the admin taps the page once.
Verify after deploy:
  1. Install from /admin on Android (Chrome menu > Install app) and on iPhone (Share > Add to Home Screen).
  2. Enable alerts, lock the phone, place a COD order: notification with vibration should appear; tap opens that order.
  3. With /admin open, place a COD order: chime, vibration and banner.
  4. Check Realtime works: if no banner appears, confirm orders is in supabase_realtime and admin RLS allows SELECT on orders.

---
# Saree "Coming soon" flash, signup verification, resend (Oct 22)
1. Products loaded asynchronously and the collection page showed "Coming soon" while the list was still empty.
   App.tsx now tracks productsLoaded; CollectionPage shows a loading skeleton until the first fetch finishes,
   and "Coming soon" only when the load succeeded and the category really is empty.
2. Signup: Supabase creates the account before the verification email is sent. If the email fails, the
   customer now sees a clear message and a "Resend verification email" button (CustomerRegister). The account
   cannot sign in until verified; the login page offers the same resend button.
3. Branded emails: configure in Supabase dashboard (Authentication > SMTP Settings with Resend, and Email Templates).
   Fully custom emails from our server are a separate later step.
Test: refresh /collection/sarees (should show skeleton, then sarees); sign up with SMTP disabled (should show
resend message); sign up normally and verify.

---
# Homepage: Most Loved Styles (Oct 22)
- "Curated Heritage Sarees" replaced by "Most Loved Styles" (src/components/home/MostLovedStyles.tsx).
- Shows 6 sarees: 2 per row on phones, 6 in a row on desktop, with a centred "View All" button (blinking).
- The selection rotates every 2 minutes. The order is a hash of (time slot, product id), so every visitor sees the same
  set within a slot and nothing is stored in the database. Only sarees with a photo are used. If none exist, the
  section is hidden (no "coming soon").
- Hero: the "The Heritage Loom" eyebrow line above the headline was removed (HeroSection.tsx).
- Count changed to 12: phones show 2 columns x 6 rows, desktop shows 6 columns x 2 rows (SHOWN_COUNT = 12).
- Hero: removed the subheading paragraph and the 100% Pure Silk / Regional / Direct stat tags. Headline and buttons kept.

---
# Hero buttons, fallback images, role labels (Oct 22)
- Hero buttons sit side by side on phones (flex-row, nowrap, slightly smaller text on phones).
- Homepage images no longer flash: while settings load, the hero shows a neutral placeholder, and the category
  section shows skeleton tiles instead of the built-in images. Built-in images only appear if the live data is empty.
- Role labels ("hero", "gallery", "full saree", "primary", etc.) removed from the product gallery, the fullscreen viewer
  and the admin product image list. Image roles still exist in data for future use.

---
# Order status emails and post-delivery review (Oct 23)
- Branded emails via Resend when an order becomes Packed, Shipped or Delivered (triggered by the admin status update).
  Each email is sent once per order and status (table order_email_log). If sending fails, the claim is released so
  the next status update retries it. The Delivered email is also the review request (no second email).
- Review form (customer account > orders > "Write a review", or the email link /account?review=VKV-...):
  delivery stars, packaging stars, one star rating per purchased product, one shared feedback text.
- Storage: order_reviews (one per order, delivery + packaging ratings, feedback) and one public.reviews row per product
  (rating + the shared feedback), so each product page shows the same feedback with that product's rating.
- Eligibility is unchanged: the order must belong to the signed-in customer and be delivered; one review per product per
  customer. Products already reviewed are skipped and not overwritten.
- Migration: 20261023000001_order_review_feedback_and_status_emails.sql (run it).
- Needs SITE_URL (or APP_URL), RESEND_API_KEY and RESEND_FROM_EMAIL set, as for the other emails.

---
# "Buy from shop" (zero delivery) and swipe-up to leave the image viewer (Oct 25)
1. Checkout step 2 now offers: "Deliver to my address" or "Buy from shop". Shop pickup needs no address, delivery charge is Rs 0,
   the pickup address shown is Admin > Store Settings > Studio address, and the payment option reads "Pay at shop (when you collect)".
   - Authoritative: the server sets the pickup address from the store settings (never from the browser) and the database function
     (migration 20261024000001_store_pickup_zero_shipping.sql) sets shipping to 0 for these orders. Coupons, GST and stock hold unchanged.
   - Orders carry fulfillmentMethod = 'store_pickup' in the address snapshot. Admin order view, customer account, order confirmation
     and invoices show "Store pickup" instead of a city/pincode; GST on the invoice is split CGST+SGST (local sale).
   - Status emails for pickup orders: Packed says "ready to collect", no "Shipped" email, Delivered says "Thank you for visiting us".
2. Fullscreen image viewer: swipe up on the photo to close it and return to the product page. The photo follows the finger and
   fades; past 90px it closes, otherwise it snaps back. The phone Back button and the X button still work. Swipe left/right and pinch zoom unchanged.
Files: server.ts, supabase/migrations/20261024000001_store_pickup_zero_shipping.sql, src/lib/orderAddress.ts (new), src/types/index.ts,
src/lib/invoiceTax.ts, src/components/checkout/CheckoutPage.tsx, OrderConfirmationPage.tsx, src/components/account/AccountPage.tsx,
src/components/admin/AdminOrders.tsx, src/components/product/MobileImageViewer.tsx
Run the migration, restart the server. Set the real shop address in Admin > Store Settings (the default is a placeholder).
Not run: type/syntax checks only; no database or phone test.

---
# Review links for guests + homepage reviews (Oct 26)
- Cause: the review link pointed to /account, which only lists orders of a signed-in account. Guest orders have no account, so
  the page showed nothing. The review form also needed login.
- Delivered email now links to /review/<token>. The token is random (256-bit), bound to one order, stored only as a SHA-256 hash
  (table order_review_links), and expires after 60 days. No login required; works for guest and signed-in customers.
- Public endpoints: GET/POST /api/review-links/:token (rate limited). One order review per order; one product review per product per order.
- reviews.user_id may now be empty (guest orders). Migration 20261025000001 also adds a unique index per (order, product).
- Homepage: "Words that wear beautifully" section below the hero. One card per reviewed order (feedback shown once, with the
  products and their star ratings, delivery and packaging stars, verified badge). Hidden when there are no reviews.
  Feed: GET /api/reviews/showcase (customer shown as first name + last initial, no email or phone).
- Emails sent before this change still carry the old /account link. Those orders can be reviewed by signed-in customers only;
  guests need a new delivered email (re-set the status to Delivered, which is allowed once per status, or resend manually).
Run migration 20261025000001 before testing.
