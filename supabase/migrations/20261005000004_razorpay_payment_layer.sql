-- =====================================================================
-- VK VASTRAM RAZORPAY PAYMENT LAYER SCHEMA EXTENSION
-- Migration: 20261005000004_razorpay_payment_layer.sql
-- =====================================================================

-- 1. Extend payments table with provider_signature, error_reason, and metadata
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS provider_signature TEXT,
  ADD COLUMN IF NOT EXISTS error_reason TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::JSONB;

-- 2. Create Webhook Events table for Webhook Idempotency and Audit Logging
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL DEFAULT 'razorpay',
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'processed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Performance Indexes on Payment Identifiers
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_order_id ON public.payments(provider_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_payment_id ON public.payments(provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_event_id ON public.payment_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_created_at ON public.payment_webhook_events(created_at DESC);

-- 4. Enable RLS on payment_webhook_events
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for payment_webhook_events (Admins only)
DROP POLICY IF EXISTS "Admins can view webhook events" ON public.payment_webhook_events;
CREATE POLICY "Admins can view webhook events"
  ON public.payment_webhook_events FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage webhook events" ON public.payment_webhook_events;
CREATE POLICY "Admins can manage webhook events"
  ON public.payment_webhook_events FOR ALL
  USING (public.is_admin(auth.uid()));
