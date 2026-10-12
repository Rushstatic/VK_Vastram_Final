-- VK VASTRAM manual fulfillment lifecycle, auditable cancellation and refund review.
-- Cancellation is transactional: it releases an open reservation OR reverses a committed sale,
-- but never marks an online payment as refunded automatically.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'not_applicable';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS courier_name text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_number text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_url text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipped_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_refund_status_check'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_refund_status_check
      CHECK (refund_status IN ('not_applicable', 'pending', 'processing', 'completed', 'failed'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.order_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  actor text NOT NULL,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.cancel_order_and_reconcile_inventory(
  p_order_id uuid,
  p_reason text DEFAULT 'order_cancelled',
  p_cancelled_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item record;
  v_release jsonb;
  v_has_sale boolean;
  v_refund_required boolean;
  v_refund_status text;
  v_reason text := left(COALESCE(NULLIF(trim(p_reason), ''), 'Order cancelled'), 500);
BEGIN
  -- Lock first so cancellation serializes with payment capture / inventory confirmation.
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND');
  END IF;

  IF v_order.order_status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', true,
      'order_id', p_order_id,
      'status', 'already_cancelled',
      'refund_status', COALESCE(v_order.refund_status, 'not_applicable'),
      'inventory_reconciled', true
    );
  END IF;

  -- Manual cancellation is only allowed before dispatch. Once handed to the courier,
  -- use the return workflow instead of pretending a parcel can be recalled atomically.
  IF v_order.order_status::text NOT IN ('pending', 'confirmed', 'packed', 'processing') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CANNOT_CANCEL_AFTER_DISPATCH',
      'message', 'This order can no longer be cancelled in the pre-dispatch workflow. Use the return workflow.'
    );
  END IF;

  v_has_sale := EXISTS (
    SELECT 1
    FROM public.inventory_movements
    WHERE reference_id = p_order_id
      AND reference_type = 'order'
      AND movement_type = 'sale'
  );

  IF v_has_sale THEN
    -- A paid online order or COD order may already have consumed physical stock.
    -- Use a distinct reference type so a future customer return cannot double-count it.
    IF NOT EXISTS (
      SELECT 1 FROM public.inventory_movements
      WHERE reference_id = p_order_id
        AND reference_type = 'order_cancellation'
        AND movement_type = 'return'
    ) THEN
      FOR v_item IN
        SELECT product_variant_id, SUM(quantity)::integer AS quantity
        FROM public.order_items
        WHERE order_id = p_order_id
          AND product_variant_id IS NOT NULL
        GROUP BY product_variant_id
        ORDER BY product_variant_id
      LOOP
        UPDATE public.product_variants
        SET stock_quantity = stock_quantity + v_item.quantity,
            updated_at = now()
        WHERE id = v_item.product_variant_id;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Cannot restore inventory: order variant % no longer exists', v_item.product_variant_id;
        END IF;

        INSERT INTO public.inventory_movements (
          product_variant_id, movement_type, quantity,
          reference_type, reference_id, notes, created_by
        ) VALUES (
          v_item.product_variant_id, 'return', v_item.quantity,
          'order_cancellation', p_order_id, v_reason, p_cancelled_by
        );
      END LOOP;
    END IF;
  ELSE
    -- Reservation-only orders go through the established release RPC.
    v_release := public.release_inventory_for_order(p_order_id, v_reason);
    IF COALESCE((v_release->>'success')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Inventory release failed for order %: %', p_order_id, COALESCE(v_release::text, '{}');
    END IF;
  END IF;

  -- Keep financial truth independent from fulfillment truth. Refunds are reviewed and
  -- executed separately; this status records whether manual follow-up is required.
  v_refund_required :=
    v_order.payment_status::text IN ('captured', 'cod_collected', 'cod_settled')
    OR EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.order_id = p_order_id
        AND p.provider <> 'cod'
        AND p.status::text = 'captured'
    );
  v_refund_status := CASE WHEN v_refund_required THEN 'pending' ELSE 'not_applicable' END;

  UPDATE public.orders
  SET order_status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = p_cancelled_by,
      cancellation_reason = v_reason,
      refund_status = v_refund_status,
      reservation_expires_at = NULL,
      updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.order_history (order_id, status, actor, notes, metadata)
  VALUES (
    p_order_id,
    'ORDER_CANCELLED',
    CASE WHEN p_cancelled_by IS NULL THEN 'Customer / system' ELSE 'Administrator / customer' END,
    v_reason,
    jsonb_build_object(
      'previous_order_status', v_order.order_status::text,
      'previous_payment_status', v_order.payment_status::text,
      'refund_status', v_refund_status,
      'inventory_reconciled', true,
      'sale_was_committed', v_has_sale
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'status', 'cancelled',
    'refund_status', v_refund_status,
    'inventory_reconciled', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_order_and_reconcile_inventory(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order_and_reconcile_inventory(uuid, text, uuid) TO service_role;


-- Atomically record manual cash-on-delivery collection and settlement.
CREATE OR REPLACE FUNCTION public.record_cod_payment_progress(
  p_order_id uuid,
  p_next_status text,
  p_actor text DEFAULT 'Administrator',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_current text;
  v_next text := lower(trim(COALESCE(p_next_status, '')));
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND');
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE order_id = p_order_id AND provider = 'cod'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_A_COD_ORDER');
  END IF;

  v_current := v_order.payment_status::text;
  IF v_next NOT IN ('cod_collected', 'cod_settled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_COD_STATUS');
  END IF;

  IF v_next = 'cod_collected' THEN
    IF v_order.order_status::text <> 'delivered' THEN
      RETURN jsonb_build_object('success', false, 'error', 'COD_COLLECTION_REQUIRES_DELIVERY', 'message', 'Record COD collection only after the order is marked Delivered.');
    END IF;
    IF v_current NOT IN ('pending', 'cod_pending') THEN
      RETURN jsonb_build_object('success', false, 'error', 'INVALID_COD_PAYMENT_TRANSITION', 'message', 'COD can be collected only when payment is pending.');
    END IF;
  ELSE
    IF v_current <> 'cod_collected' THEN
      RETURN jsonb_build_object('success', false, 'error', 'INVALID_COD_PAYMENT_TRANSITION', 'message', 'COD must be recorded as collected before it can be settled.');
    END IF;
  END IF;

  UPDATE public.orders
  SET payment_status = v_next::public.payment_status,
      updated_at = now()
  WHERE id = p_order_id;

  UPDATE public.payments
  SET status = v_next::public.payment_status,
      verified_at = CASE WHEN v_next = 'cod_collected' THEN now() ELSE verified_at END,
      updated_at = now()
  WHERE id = v_payment.id;

  INSERT INTO public.order_history (order_id, status, actor, notes, metadata)
  VALUES (
    p_order_id,
    'PAYMENT_' || upper(v_next),
    COALESCE(NULLIF(trim(p_actor), ''), 'Administrator'),
    COALESCE(NULLIF(trim(p_notes), ''), CASE WHEN v_next = 'cod_collected' THEN 'Cash received from customer on delivery.' ELSE 'COD collection reconciled with store accounts.' END),
    jsonb_build_object('previous_payment_status', v_current, 'new_payment_status', v_next, 'provider', 'cod')
  );

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'payment_status', v_next);
END;
$$;

REVOKE ALL ON FUNCTION public.record_cod_payment_progress(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_cod_payment_progress(uuid, text, text, text) TO service_role;

-- Refund status is a separate financial workflow. This never calls a payment provider;
-- the administrator records verified manual/provider actions only after doing them.
CREATE OR REPLACE FUNCTION public.update_order_refund_status(
  p_order_id uuid,
  p_next_status text,
  p_actor text DEFAULT 'Administrator',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_current text;
  v_next text := lower(trim(COALESCE(p_next_status, '')));
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND');
  END IF;

  v_current := COALESCE(v_order.refund_status, 'not_applicable');
  IF v_order.order_status::text NOT IN ('cancelled', 'returned', 'refunded') THEN
    RETURN jsonb_build_object('success', false, 'error', 'REFUND_NOT_APPLICABLE', 'message', 'Refund workflow is available only for cancelled or returned orders.');
  END IF;
  IF v_current NOT IN ('pending', 'processing', 'failed') OR v_next NOT IN ('processing', 'completed', 'failed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_REFUND_TRANSITION', 'message', 'This refund status cannot be changed through the manual workflow.');
  END IF;
  IF v_current = 'processing' AND v_next = 'processing' THEN
    RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'refund_status', v_current, 'message', 'Refund is already processing.');
  END IF;
  IF v_current = 'pending' AND v_next = 'failed' THEN
    -- Allowed if the external/manual refund attempt was rejected.
    NULL;
  ELSIF v_current = 'pending' AND v_next NOT IN ('processing', 'completed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_REFUND_TRANSITION');
  ELSIF v_current = 'processing' AND v_next NOT IN ('completed', 'failed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_REFUND_TRANSITION');
  ELSIF v_current = 'failed' AND v_next <> 'processing' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_REFUND_TRANSITION', 'message', 'A failed refund must be retried before completion.');
  END IF;

  UPDATE public.orders
  SET refund_status = v_next,
      payment_status = CASE
        WHEN v_next = 'completed' AND payment_status::text IN ('captured', 'cod_collected', 'cod_settled')
          THEN 'refunded'::public.payment_status
        ELSE payment_status
      END,
      updated_at = now()
  WHERE id = p_order_id;

  IF v_next = 'completed' THEN
    UPDATE public.payments
    SET status = 'refunded'::public.payment_status,
        updated_at = now()
    WHERE order_id = p_order_id
      AND status::text IN ('captured', 'cod_collected', 'cod_settled');
  END IF;

  INSERT INTO public.order_history (order_id, status, actor, notes, metadata)
  VALUES (
    p_order_id,
    'REFUND_' || upper(v_next),
    COALESCE(NULLIF(trim(p_actor), ''), 'Administrator'),
    COALESCE(NULLIF(trim(p_notes), ''), 'Manual refund workflow status recorded by administrator.'),
    jsonb_build_object('previous_refund_status', v_current, 'new_refund_status', v_next)
  );

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'refund_status', v_next);
END;
$$;

REVOKE ALL ON FUNCTION public.update_order_refund_status(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_refund_status(uuid, text, text, text) TO service_role;
