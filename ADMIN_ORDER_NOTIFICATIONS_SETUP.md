# VK VASTRAM — Admin-only order notifications

This patch is based on the current uploaded project and targets the store administrator, not customers. It adds an admin header control, Web Push subscription, a separate database table, admin email alerts for new orders, and push/email alerts for admin order-status transitions.

## Apply migration
Review `supabase/migrations/20261014000002_admin_push_notifications.sql` and apply it once to the correct Supabase project. It creates `admin_push_subscriptions` only. Do not reset the database. Since earlier migrations were manually applied and history repaired, update CLI history for this new migration only after the SQL actually succeeds.

## Backend environment variables
Set in server hosting environment (not `VITE_`): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:support@vkvastram.in`, `ADMIN_NOTIFICATION_EMAIL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (verified sender), and `SITE_URL=https://vkvastram.in`. Generate VAPID keys with `npx web-push generate-vapid-keys`.

## Install/check
Run `npm install` to refresh `package-lock.json`, then `npm run lint` and `npm run build`. Test on HTTPS staging with a persisted admin account whose `profiles.role` is exactly `admin`. The API checks this role server-side; customer accounts should receive 403. Enable push using the bell control in the admin header, place a low-value test order, verify admin email/push, then change its status and verify the update alert.

## Locked phone and custom sound
Web Push can show an OS notification while the phone is locked on supported devices after permission is granted and the service worker, subscription, network, and OS settings are correct. Delivery is not guaranteed at native-app level. OS/browser controls system notification sounds. The custom sound preview plays only in the active admin page and cannot force a custom sound when the page is closed.

## Scope/limits
New order and admin order-status events are covered. Payment success is not inferred from a client redirect; payment-specific notifications should be wired to the verified Razorpay webhook/payment reconciliation path if required. Push/email delivery is best effort and never rolls back an order.
