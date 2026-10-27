-- =====================================================================
-- Review links that work without an account (guest checkout) + reviews on the homepage.
--   * order_review_links: one private, expiring link per delivered order (only a SHA-256 hash is stored).
--   * reviews.user_id may be empty for guest orders. A product can still be reviewed once per order.
-- Safe to run more than once.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.order_review_links (
  order_id UUID PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.order_review_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_review_links FROM anon, authenticated;

DO $$
BEGIN
  ALTER TABLE public.reviews ALTER COLUMN user_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'reviews.user_id already nullable or could not change: %', SQLERRM;
END;
$$;

-- One review row per product per order (guest reviews are identified by the order, not a user).
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS reviews_order_product_unique
    ON public.reviews (order_id, product_id) WHERE order_id IS NOT NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'reviews_order_product_unique not created (duplicate rows exist?): %', SQLERRM;
END;
$$;
