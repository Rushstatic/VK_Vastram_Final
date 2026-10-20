-- Atomically reconcile a Razorpay capture against order cancellation and inventory.
-- This function takes the same order-row lock used by cancel_order_and_release_inventory.
-- A captured payment for an already-cancelled order is recorded but never revives the order
-- or confirms inventory; callers must trigger refund/manual review.

CREATE OR REPLACE FUNCTION public.reconcile_captured_payment_for_order(
  p_order_id UUID,
  p_provider_order_id TEXT,
  p_provider_payment_id TEXT,
  p_provider_signature TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_inventory_result JSONB;
BEGIN
  IF p_order_id IS NULL OR NULLIF(p_provider_order_id, '') IS NULL OR NULLIF(p_provider_payment_id, '') IS NULL THEN
    RAISE EXCEPTION 'Payment reconciliation identifiers are required' USING ERRCODE = '22023';
  END IF;

  -- Serialize against cancellation before touching payment or inventory state.
  SELECT * INTO v_order
    FROM public.orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found for payment reconciliation' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_payment
    FROM public.payments
   WHERE order_id = p_order_id
     AND provider_order_id = p_provider_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Persisted Razorpay payment attempt does not match this order' USING ERRCODE = 'P0001';
  END IF;

  IF v_payment.provider_payment_id IS NOT NULL
     AND v_payment.provider_payment_id <> p_provider_payment_id THEN
    RAISE EXCEPTION 'Razorpay payment ID does not match the persisted payment attempt' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.payments
     SET status = 'captured',
         provider_payment_id = p_provider_payment_id,
         provider_signature = COALESCE(p_provider_signature, provider_signature),
         verified_at = COALESCE(verified_at, NOW()),
         updated_at = NOW(),
         method = COALESCE(method, 'Razorpay Online')
   WHERE id = v_payment.id;

  UPDATE public.orders
     SET payment_status = 'captured',
         updated_at = NOW()
   WHERE id = p_order_id;

  IF v_order.order_status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'refund_required', TRUE,
      'order_status', 'cancelled',
      'inventory_confirmed', FALSE
    );
  END IF;

  IF v_order.order_status::TEXT IN ('pending', 'pending_payment') THEN
    UPDATE public.orders
       SET order_status = 'confirmed',
           updated_at = NOW()
     WHERE id = p_order_id;
  END IF;

  -- Existing RPC is idempotent; execute it inside this transaction while the order lock
  -- remains held, so cancellation cannot release stock midway through confirmation.
  v_inventory_result := public.confirm_inventory_sale_for_order(p_order_id);
  IF COALESCE((v_inventory_result->>'success')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'Inventory confirmation failed during payment reconciliation'
      USING ERRCODE = 'P0001', DETAIL = COALESCE(v_inventory_result::TEXT, '{}');
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'refund_required', FALSE,
    'order_status', CASE WHEN v_order.order_status::TEXT IN ('pending', 'pending_payment') THEN 'confirmed' ELSE v_order.order_status::TEXT END,
    'inventory_confirmed', TRUE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_captured_payment_for_order(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_captured_payment_for_order(UUID, TEXT, TEXT, TEXT) TO service_role;
