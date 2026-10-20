-- Payment-attempt and public-data hardening.
-- Safe to re-run. Existing payment rows are retained as historical attempts.
BEGIN;

-- A Razorpay order ID identifies exactly one persisted attempt. The payments table
-- already supports multiple rows per internal order; application code must INSERT
-- each attempt rather than overwriting the previous provider_order_id.
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_order_id_unique
  ON public.payments (provider_order_id)
  WHERE provider_order_id IS NOT NULL;

-- Public coupon codes are no longer directly enumerable through PostgREST.
-- Checkout validates coupons through the server-side endpoint using service_role;
-- coupon management also remains on authenticated admin server endpoints.
DROP POLICY IF EXISTS "Public can view active coupons" ON public.coupons;

-- Internal settings must not be readable simply because the table is public.
-- Keep only settings currently consumed by the storefront's public settings service
-- and the public saree-type selector. Admin/server access is unchanged.
DROP POLICY IF EXISTS "Public can view site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Public can view storefront settings" ON public.site_settings;

CREATE POLICY "Public can view storefront settings"
  ON public.site_settings
  FOR SELECT
  USING (
    key IN ('general', 'policies', 'saree_types', 'fabric_types')
  );

CREATE OR REPLACE FUNCTION public.reconcile_captured_payment_for_order(
  p_order_id UUID,
  p_provider_order_id TEXT,
  p_provider_payment_id TEXT,
  p_provider_signature TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_other_captured public.payments%ROWTYPE;
  v_inventory_result JSONB;
BEGIN
  IF p_order_id IS NULL OR NULLIF(p_provider_order_id, '') IS NULL OR NULLIF(p_provider_payment_id, '') IS NULL THEN
    RAISE EXCEPTION 'Payment reconciliation identifiers are required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found for payment reconciliation' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_payment FROM public.payments
   WHERE order_id = p_order_id AND provider_order_id = p_provider_order_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Persisted Razorpay payment attempt does not match this order' USING ERRCODE = 'P0001';
  END IF;
  IF v_payment.provider_payment_id IS NOT NULL AND v_payment.provider_payment_id <> p_provider_payment_id THEN
    RAISE EXCEPTION 'Razorpay payment ID does not match the persisted payment attempt' USING ERRCODE = 'P0001';
  END IF;

  -- If a different attempt already paid this order, preserve the new captured payment
  -- for refund/manual review without re-confirming inventory or replacing the first proof.
  IF v_order.payment_status = 'captured' AND v_payment.status <> 'captured' THEN
    SELECT * INTO v_other_captured FROM public.payments
     WHERE order_id = p_order_id AND status = 'captured'
       AND provider_payment_id IS DISTINCT FROM p_provider_payment_id
     ORDER BY verified_at NULLS LAST, created_at
     LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      UPDATE public.payments SET status = 'captured', provider_payment_id = p_provider_payment_id,
        provider_signature = COALESCE(p_provider_signature, provider_signature),
        verified_at = COALESCE(verified_at, NOW()), updated_at = NOW(),
        method = COALESCE(method, 'Razorpay Online')
       WHERE id = v_payment.id;
      RETURN jsonb_build_object('success', TRUE, 'refund_required', TRUE,
        'order_status', v_order.order_status::TEXT, 'inventory_confirmed', FALSE,
        'duplicate_capture', TRUE);
    END IF;
  END IF;

  UPDATE public.payments SET status = 'captured', provider_payment_id = p_provider_payment_id,
    provider_signature = COALESCE(p_provider_signature, provider_signature),
    verified_at = COALESCE(verified_at, NOW()), updated_at = NOW(),
    method = COALESCE(method, 'Razorpay Online')
   WHERE id = v_payment.id;

  IF v_order.order_status = 'cancelled' THEN
    UPDATE public.orders SET payment_status = 'captured', updated_at = NOW() WHERE id = p_order_id;
    RETURN jsonb_build_object('success', TRUE, 'refund_required', TRUE,
      'order_status', 'cancelled', 'inventory_confirmed', FALSE);
  END IF;

  UPDATE public.orders SET payment_status = 'captured', updated_at = NOW() WHERE id = p_order_id;
  IF v_order.order_status::TEXT IN ('pending', 'pending_payment') THEN
    UPDATE public.orders SET order_status = 'confirmed', updated_at = NOW() WHERE id = p_order_id;
  END IF;

  v_inventory_result := public.confirm_inventory_sale_for_order(p_order_id);
  IF COALESCE((v_inventory_result->>'success')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'Inventory confirmation failed during payment reconciliation'
      USING ERRCODE = 'P0001', DETAIL = COALESCE(v_inventory_result::TEXT, '{}');
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'refund_required', FALSE,
    'order_status', CASE WHEN v_order.order_status::TEXT IN ('pending', 'pending_payment')
      THEN 'confirmed' ELSE v_order.order_status::TEXT END,
    'inventory_confirmed', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_captured_payment_for_order(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_captured_payment_for_order(UUID, TEXT, TEXT, TEXT) TO service_role;
ALTER FUNCTION public.reconcile_captured_payment_for_order(UUID, TEXT, TEXT, TEXT)
  SET search_path = pg_catalog, public, pg_temp;

COMMIT;
