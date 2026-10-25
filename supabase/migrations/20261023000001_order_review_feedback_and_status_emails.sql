-- =====================================================================
-- Order-level review feedback + one-time status emails.
-- * order_reviews: one review per delivered order (delivery + packaging ratings, shared feedback).
--   Product ratings are still written to public.reviews (one per product per customer), so the
--   existing product review rules and product-page display are unchanged.
-- * order_email_log: guarantees each status email (packed / shipped / delivered) is sent once.
-- Safe to run more than once. Server (service role) access only.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.order_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  delivery_rating INT NOT NULL CHECK (delivery_rating BETWEEN 1 AND 5),
  packaging_rating INT NOT NULL CHECK (packaging_rating BETWEEN 1 AND 5),
  feedback TEXT NOT NULL CHECK (char_length(feedback) BETWEEN 10 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.order_reviews ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.order_email_log (
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event TEXT NOT NULL CHECK (event IN ('packed', 'shipped', 'delivered')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (order_id, event)
);
ALTER TABLE public.order_email_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.order_reviews FROM anon, authenticated;
REVOKE ALL ON public.order_email_log FROM anon, authenticated;
