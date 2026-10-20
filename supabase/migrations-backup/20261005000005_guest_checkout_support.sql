-- =====================================================================
-- VK VASTRAM GUEST CHECKOUT & OPTIONAL ACCOUNT REGISTRATION
-- Migration: 20261005000005_guest_checkout_support.sql
-- =====================================================================

-- 1. Ensure orders.user_id is nullable (safe idempotent operation)
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;

-- 2. Add customer contact & guest tracking columns to public.orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS guest_access_token TEXT;

-- 3. Create indexes for efficient guest order tracking and reconciliation
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_guest_access_token ON public.orders(guest_access_token);
CREATE INDEX IF NOT EXISTS idx_orders_is_guest ON public.orders(is_guest);

-- 4. Secure Row-Level Security (RLS) policies for orders
-- Drop previous insert/select policies on orders if they exist to replace with guest-friendly rules
DROP POLICY IF EXISTS "Authenticated users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Allow guest and authenticated order creation" ON public.orders;
DROP POLICY IF EXISTS "Allow order viewing" ON public.orders;

-- Anyone (authenticated customer or guest) can create an order.
-- For authenticated users, user_id must equal auth.uid().
-- For guest users, user_id must be NULL.
CREATE POLICY "Allow guest and authenticated order creation"
  ON public.orders FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR
    (user_id IS NULL)
  );

-- Users can view their own orders; admins can view all orders;
-- Guest orders can be retrieved by their specific ID (e.g. for confirmation screen)
CREATE POLICY "Allow order viewing"
  ON public.orders FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR
    (user_id IS NULL)
    OR
    public.is_admin(auth.uid())
  );

-- 5. Secure RLS policies for order_items
DROP POLICY IF EXISTS "Users can insert order items for own orders" ON public.order_items;
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow guest and authenticated order item insertion" ON public.order_items;
DROP POLICY IF EXISTS "Allow order items viewing" ON public.order_items;

CREATE POLICY "Allow guest and authenticated order item insertion"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
      AND (
        (auth.uid() IS NOT NULL AND o.user_id = auth.uid())
        OR
        (o.user_id IS NULL)
        OR
        public.is_admin(auth.uid())
      )
    )
  );

CREATE POLICY "Allow order items viewing"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
      AND (
        (auth.uid() IS NOT NULL AND o.user_id = auth.uid())
        OR
        (o.user_id IS NULL)
        OR
        public.is_admin(auth.uid())
      )
    )
  );

-- 6. Secure RLS policies for payments
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Allow guest and authenticated payment viewing" ON public.payments;

CREATE POLICY "Allow guest and authenticated payment viewing"
  ON public.payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
      AND (
        (auth.uid() IS NOT NULL AND o.user_id = auth.uid())
        OR
        (o.user_id IS NULL)
        OR
        public.is_admin(auth.uid())
      )
    )
  );

-- 7. Helper function to safely link guest orders to a newly created account
CREATE OR REPLACE FUNCTION public.link_guest_orders_to_user(
  target_user_id UUID,
  target_email TEXT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  linked_count INT := 0;
BEGIN
  IF target_user_id IS NULL OR target_email IS NULL OR target_email = '' THEN
    RETURN 0;
  END IF;

  UPDATE public.orders
  SET
    user_id = target_user_id,
    is_guest = FALSE,
    updated_at = NOW()
  WHERE
    user_id IS NULL
    AND (
      LOWER(customer_email) = LOWER(target_email)
      OR
      LOWER(shipping_address_snapshot->>'email') = LOWER(target_email)
    );

  GET DIAGNOSTICS linked_count = ROW_COUNT;
  RETURN linked_count;
END;
$$;
