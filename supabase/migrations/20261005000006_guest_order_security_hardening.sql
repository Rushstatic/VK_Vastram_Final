-- =====================================================================
-- VK VASTRAM GUEST ORDER SECURITY & PRIVACY HARDENING
-- Migration: 20261005000006_guest_order_security_hardening.sql
-- =====================================================================

-- 1. Add guest_access_token_hash column to public.orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS guest_access_token_hash TEXT;

-- 2. Index on guest_access_token_hash for constant-time lookup
CREATE INDEX IF NOT EXISTS idx_orders_guest_access_token_hash
  ON public.orders(guest_access_token_hash);

-- 3. Backfill any existing guest_access_token into guest_access_token_hash using sha256
-- (Only if pgcrypto is enabled, otherwise application layer handles migration)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    UPDATE public.orders
    SET guest_access_token_hash = encode(digest(guest_access_token, 'sha256'), 'hex')
    WHERE guest_access_token IS NOT NULL AND guest_access_token_hash IS NULL;
  END IF;
END $$;

-- 4. HARDEN ROW-LEVEL SECURITY (RLS)
-- Drop previously permissive (user_id IS NULL) policies that exposed guest orders to public anon queries
DROP POLICY IF EXISTS "Allow order viewing" ON public.orders;
DROP POLICY IF EXISTS "Allow order items viewing" ON public.order_items;
DROP POLICY IF EXISTS "Allow guest and authenticated payment viewing" ON public.payments;
DROP POLICY IF EXISTS "Strict orders viewing" ON public.orders;
DROP POLICY IF EXISTS "Strict order items viewing" ON public.order_items;
DROP POLICY IF EXISTS "Strict payments viewing" ON public.payments;

-- Orders: Authenticated customers can view ONLY their own orders. Admins can view all orders.
-- Unauthenticated anon clients CANNOT view arbitrary guest orders via direct client queries.
-- Guest orders are served exclusively through the secure, server-side verified /api/orders/:id endpoint.
CREATE POLICY "Strict orders viewing"
  ON public.orders FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR
    public.is_admin(auth.uid())
  );

-- Order Items: Only viewable by authenticated order owners or admins.
CREATE POLICY "Strict order items viewing"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
      AND (
        (auth.uid() IS NOT NULL AND o.user_id = auth.uid())
        OR
        public.is_admin(auth.uid())
      )
    )
  );

-- Payments: Only viewable by authenticated order owners or admins.
CREATE POLICY "Strict payments viewing"
  ON public.payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
      AND (
        (auth.uid() IS NOT NULL AND o.user_id = auth.uid())
        OR
        public.is_admin(auth.uid())
      )
    )
  );

-- 5. Harden stored procedure for linking verified guest orders
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
  sanitized_email TEXT;
BEGIN
  -- Strict validation of inputs
  IF target_user_id IS NULL OR target_email IS NULL OR TRIM(target_email) = '' THEN
    RETURN 0;
  END IF;

  sanitized_email := LOWER(TRIM(target_email));

  -- Reconcile only unassociated guest orders (user_id IS NULL).
  -- Never reassign or claim another customer's authenticated orders.
  UPDATE public.orders
  SET
    user_id = target_user_id,
    is_guest = FALSE,
    guest_access_token = NULL,
    guest_access_token_hash = NULL,
    updated_at = NOW()
  WHERE
    user_id IS NULL
    AND (
      LOWER(customer_email) = sanitized_email
      OR
      LOWER(shipping_address_snapshot->>'email') = sanitized_email
    );

  GET DIAGNOSTICS linked_count = ROW_COUNT;
  RETURN linked_count;
END;
$$;
