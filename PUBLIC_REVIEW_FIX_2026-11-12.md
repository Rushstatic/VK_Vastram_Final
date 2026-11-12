# VK VASTRAM — Public review submission fix (12 Nov 2026)

## What was failing

The `/review` form uploads photos to Supabase Storage first, then inserts the review into
`public.store_reviews`. The submit route previously discarded the Supabase error and always
returned the same generic 500 message. If the `store_reviews` migration had not been run in the
production database (or the service role lacked table privileges), the customer saw:

> Could not save your review. Please try again.

## Code changes

- The submit endpoint now logs the Supabase error code/message/details/hint without logging
  customer names, review text, photo URLs, or request bodies.
- Missing-table/schema-cache and permission errors are identified and return a clear temporary
  availability message instead of being disguised as an unexplained generic failure.
- The photo URL allow-list now uses the resolved Supabase URL (`SUPABASE_URL` or
  `VITE_SUPABASE_URL`) used by the actual server client, preventing valid uploaded photos from
  being silently discarded on deployments that only configure the VITE-prefixed URL.
- Photo upload failures now log safe diagnostics too.

## Required production database step

The ZIP includes:

`supabase/migrations/20261112000001_store_reviews_permissions_and_repair.sql`

Run that SQL once in **Supabase Dashboard → SQL Editor → New query → Run** for the same Supabase
project used by the live website. It is idempotent and safe whether the original
`20261101000001_store_reviews.sql` migration was already applied or not. It creates the table if
missing, enables RLS, denies direct client access, grants the server `service_role`, and refreshes
the PostgREST schema cache.

Then deploy this ZIP's application code to Render. No frontend environment variable or public
anon-key change is required. Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only; do not put it in
any `VITE_` variable.

## Verify after deployment

1. Open `https://vkvastram.in/review`.
2. Submit a test review with a 1–5 star rating and at least 10 characters.
3. Confirm the success state appears and the row exists in Supabase → Table Editor → `store_reviews`.
4. If it still fails, inspect Render logs for `[store-reviews] submit failed`; the safe `code` and
   `message` fields now identify the actual database failure.

Existing review rows and product/order review tables are not modified or deleted by this patch.
