-- Persist optional cart customizations (such as Fall & Pico) for authenticated customers.
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;
