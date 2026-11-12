-- VK VASTRAM public store-review repair.
-- Safe to run even if 20261101000001_store_reviews.sql was already applied.
-- The API writes through the server-side Supabase service-role client only.

CREATE TABLE IF NOT EXISTS public.store_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL DEFAULT 'Customer' CHECK (char_length(customer_name) <= 60),
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT NOT NULL CHECK (char_length(feedback) BETWEEN 10 AND 2000),
  photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS store_reviews_status_created_idx
  ON public.store_reviews (status, created_at DESC);

ALTER TABLE public.store_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.store_reviews FROM anon, authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.store_reviews TO service_role;

-- Make newly-created or repaired table metadata visible to the Supabase REST API.
NOTIFY pgrst, 'reload schema';
