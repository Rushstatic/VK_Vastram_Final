-- =====================================================================
-- VK VASTRAM ORDER MANAGEMENT & FULFILLMENT ENHANCEMENTS
-- Migration: 20261005000009_order_management_enhancements.sql
-- =====================================================================

-- 1. Alter order_status and payment_status enums to include extra statuses
-- Since ALTER TYPE ADD VALUE cannot run inside a multi-statement transaction in some PG versions, we do it safely:
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'packed';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'out_for_delivery';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'return_requested';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'refunded';

ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'cod_pending';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'cod_collected';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'cod_settled';

-- 2. Create order_history table
CREATE TABLE IF NOT EXISTS public.order_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- The status or event name
  actor TEXT NOT NULL, -- 'Customer', 'Admin', 'Razorpay Webhook', 'System', etc.
  notes TEXT, -- Optional notes/description
  metadata JSONB DEFAULT '{}'::JSONB, -- Optional additional details
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Add admin_notes column to public.orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- 4. Enable RLS on order_history
ALTER TABLE public.order_history ENABLE ROW LEVEL SECURITY;

-- 5. Create policies for order_history: Admin can do anything, customer can view their own order's history.
DROP POLICY IF EXISTS "Admin full access on order_history" ON public.order_history;
CREATE POLICY "Admin full access on order_history" ON public.order_history
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "Customer can view their own order_history" ON public.order_history;
CREATE POLICY "Customer can view their own order_history" ON public.order_history
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_history.order_id AND orders.user_id = auth.uid()
  ));
