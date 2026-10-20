-- Review fields used by the public and moderation APIs were missing from the original
-- reviews table definition. Add them without dropping existing review data.
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS verified_purchase boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS moderation_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Existing records may represent reviews from completed purchases; do not backfill them
-- as verified without evidence. New verified-purchase reviews set this field explicitly.
