-- VK VASTRAM: manual courier tracking metadata for fulfillment operations.
-- Safe to apply repeatedly; does not alter payment or inventory behavior.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS courier_name text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_number text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_url text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipped_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
