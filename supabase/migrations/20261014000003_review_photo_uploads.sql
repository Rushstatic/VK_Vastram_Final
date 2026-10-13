ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS review_images JSONB NOT NULL DEFAULT '[]'::jsonb;
