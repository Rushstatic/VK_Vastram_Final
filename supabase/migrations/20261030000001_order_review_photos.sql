-- Customer photos on order reviews (stored in the existing store-assets bucket under reviews/order/<order id>/).
ALTER TABLE public.order_reviews ADD COLUMN IF NOT EXISTS photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb;
