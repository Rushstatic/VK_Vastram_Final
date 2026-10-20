-- =====================================================================
-- VK VASTRAM SECURITY HARDENING (2026-10-16)
-- Applies after all existing migrations. Safe to re-run.
--
-- Goal: close direct public write paths and restrict SECURITY DEFINER functions
-- that mutate inventory, payments, or ownership-sensitive order records.
-- =====================================================================

-- 1. Only the trusted server role may create or mutate transactional records.
-- Customer order reads remain governed by the existing RLS policies.
DROP POLICY IF EXISTS "Authenticated users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Allow guest and authenticated order creation" ON public.orders;
DROP POLICY IF EXISTS "Users can insert order items for own orders" ON public.order_items;
DROP POLICY IF EXISTS "Allow guest and authenticated order item insertion" ON public.order_items;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.orders FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.order_items FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.payments FROM PUBLIC, anon, authenticated;

-- Payment proof/signature and provider error details are server-side data. Permit
-- authenticated customers to read only the payment fields used by the storefront.
REVOKE SELECT ON TABLE public.payments FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, order_id, provider, provider_order_id, provider_payment_id, amount, currency, status, method, verified_at, created_at)
  ON TABLE public.payments TO authenticated;

-- 2. Guest carts are stored in browser localStorage. Database carts belong to
-- authenticated users only; no row with user_id IS NULL is shared among visitors.
DROP POLICY IF EXISTS "Users can manage own cart" ON public.carts;
CREATE POLICY "Users can manage own cart"
  ON public.carts FOR ALL
  USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Users can manage own cart items" ON public.cart_items;
CREATE POLICY "Users can manage own cart items"
  ON public.cart_items FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.carts c
      WHERE c.id = cart_id
        AND (
          (auth.uid() IS NOT NULL AND c.user_id = auth.uid())
          OR public.is_admin(auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.carts c
      WHERE c.id = cart_id
        AND (
          (auth.uid() IS NOT NULL AND c.user_id = auth.uid())
          OR public.is_admin(auth.uid())
        )
    )
  );

-- 3. Restrict inventory and guest-order SECURITY DEFINER RPC execution.
-- PUBLIC includes roles that otherwise receive the default EXECUTE privilege.
REVOKE ALL ON FUNCTION public.reserve_inventory_for_order(UUID, JSONB, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_inventory_for_order(UUID, JSONB, INT) TO service_role;
ALTER FUNCTION public.reserve_inventory_for_order(UUID, JSONB, INT)
  SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.confirm_inventory_sale_for_order(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_inventory_sale_for_order(UUID) TO service_role;
ALTER FUNCTION public.confirm_inventory_sale_for_order(UUID)
  SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.release_inventory_for_order(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_inventory_for_order(UUID, TEXT) TO service_role;
ALTER FUNCTION public.release_inventory_for_order(UUID, TEXT)
  SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.reconcile_expired_reservations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_expired_reservations() TO service_role;
ALTER FUNCTION public.reconcile_expired_reservations()
  SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.return_inventory_for_order_item(UUID, UUID, INT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.return_inventory_for_order_item(UUID, UUID, INT, TEXT) TO service_role;
ALTER FUNCTION public.return_inventory_for_order_item(UUID, UUID, INT, TEXT)
  SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.link_guest_orders_to_user(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_guest_orders_to_user(UUID, TEXT) TO service_role;
ALTER FUNCTION public.link_guest_orders_to_user(UUID, TEXT)
  SET search_path = pg_catalog, public, pg_temp;

-- 4. Harden search_path for other already-restricted privileged functions too.
-- These RPCs already have server-only grants in earlier migrations.
ALTER FUNCTION public.create_order_with_inventory_reservation(JSONB, JSONB, TEXT, INT)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.cancel_order_and_release_inventory(UUID, TEXT, TEXT)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.reconcile_captured_payment_for_order(UUID, TEXT, TEXT, TEXT)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.cancel_order_and_reconcile_inventory(UUID, TEXT, UUID)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.record_cod_payment_progress(UUID, TEXT, TEXT, TEXT)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.update_order_refund_status(UUID, TEXT, TEXT, TEXT)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.snapshot_order_item_gst_components()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.mark_back_in_stock_subscriptions_ready()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.is_admin(UUID)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.guard_profile_role_update()
  SET search_path = pg_catalog, public, auth, pg_temp;
ALTER FUNCTION public.handle_new_user()
  SET search_path = pg_catalog, public, pg_temp;

