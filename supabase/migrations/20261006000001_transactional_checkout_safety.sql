-- Transactional order creation and cancellation using the existing inventory lifecycle.
-- The established reserve/confirm/release RPC implementations are called unchanged.

CREATE OR REPLACE FUNCTION public.create_order_with_inventory_reservation(
  p_order JSONB,
  p_items JSONB,
  p_payment_method TEXT,
  p_reservation_minutes INT DEFAULT 15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_user_id UUID;
  v_item JSONB;
  v_variant RECORD;
  v_variant_id UUID;
  v_product_id UUID;
  v_quantity INT;
  v_price NUMERIC(10,2);
  v_line_total NUMERIC(10,2);
  v_subtotal NUMERIC(10,2) := 0;
  v_priced_items JSONB := '[]'::JSONB;
  v_reservation_items JSONB := '[]'::JSONB;
  v_reservation JSONB;
  v_confirmation JSONB;
BEGIN
  IF p_payment_method NOT IN ('online', 'cod') OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Invalid checkout input' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) AS line
    GROUP BY line->>'variant_id' HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate variant lines are not allowed' USING ERRCODE = '22023';
  END IF;
  IF p_order->'shipping_address_snapshot' IS NULL OR jsonb_typeof(p_order->'shipping_address_snapshot') <> 'object' THEN
    RAISE EXCEPTION 'Shipping address is required' USING ERRCODE = '22023';
  END IF;

  v_user_id := NULLIF(p_order->>'user_id', '')::UUID;
  v_order_number := p_order->>'order_number';
  IF v_order_number IS NULL OR v_order_number = '' THEN
    RAISE EXCEPTION 'Order number is required' USING ERRCODE = '22023';
  END IF;

  -- Lock and price each real active product/variant pair before taking snapshots.
  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_items)
    ORDER BY (value->>'variant_id')::UUID
  LOOP
    v_variant_id := (v_item->>'variant_id')::UUID;
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INT;
    IF v_variant_id IS NULL OR v_product_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid variant or quantity' USING ERRCODE = '22023';
    END IF;

    SELECT pv.id, pv.product_id, pv.sku, pv.variant_name, pv.price_override,
           pv.is_active, p.name AS product_name, p.price AS product_price, p.status::TEXT AS product_status
      INTO v_variant
      FROM public.product_variants pv
      JOIN public.products p ON p.id = pv.product_id
     WHERE pv.id = v_variant_id
     FOR SHARE OF pv, p;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variant does not exist' USING ERRCODE = 'P0001', DETAIL = '{"error":"VARIANT_NOT_FOUND"}';
    END IF;
    IF v_variant.product_id <> v_product_id THEN
      RAISE EXCEPTION 'Variant does not belong to the selected product' USING ERRCODE = 'P0001', DETAIL = '{"error":"VARIANT_NOT_FOUND"}';
    END IF;
    IF NOT v_variant.is_active OR v_variant.product_status <> 'active' THEN
      RAISE EXCEPTION 'Product or variant is unavailable' USING ERRCODE = 'P0001', DETAIL = '{"error":"PRODUCT_UNAVAILABLE"}';
    END IF;

    v_price := COALESCE(v_variant.price_override, v_variant.product_price);
    IF v_price IS NULL OR v_price < 0 OR v_price::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'Product price is invalid' USING ERRCODE = 'P0001', DETAIL = '{"error":"INVALID_PRICE"}';
    END IF;
    v_line_total := ROUND(v_price * v_quantity, 2);
    v_subtotal := v_subtotal + v_line_total;

    v_reservation_items := v_reservation_items || jsonb_build_array(jsonb_build_object(
      'variant_id', v_variant_id,
      'quantity', v_quantity
    ));

    -- Temporarily stage the authoritative line rows in a JSON array. They are inserted below
    -- after the order row exists; product identity and price are re-read under row locks.
    v_item := v_item || jsonb_build_object(
      'product_name_snapshot', v_variant.product_name,
      'sku_snapshot', v_variant.sku,
      'price_snapshot', v_price,
      'total_amount', v_line_total
    );
    v_priced_items := v_priced_items || jsonb_build_array(v_item);
  END LOOP;

  INSERT INTO public.orders (
    order_number, user_id, customer_name, customer_email, customer_phone, is_guest,
    guest_access_token_hash, shipping_address_snapshot, billing_address_snapshot,
    subtotal, discount_amount, shipping_amount, tax_amount, total_amount, currency,
    payment_status, order_status, notes
  ) VALUES (
    v_order_number, v_user_id, NULLIF(p_order->>'customer_name', ''), NULLIF(p_order->>'customer_email', ''),
    NULLIF(p_order->>'customer_phone', ''), COALESCE((p_order->>'is_guest')::BOOLEAN, v_user_id IS NULL),
    NULLIF(p_order->>'guest_access_token_hash', ''), p_order->'shipping_address_snapshot', p_order->'billing_address_snapshot',
    v_subtotal, 0, 0, 0, v_subtotal, 'INR', 'pending',
    CASE WHEN p_payment_method = 'cod' THEN 'confirmed'::public.order_status ELSE 'pending'::public.order_status END,
    NULLIF(p_order->>'notes', '')
  ) RETURNING id INTO v_order_id;

  INSERT INTO public.order_items (
    order_id, product_variant_id, product_name_snapshot, sku_snapshot,
    price_snapshot, quantity, total_amount, product_metadata_snapshot
  )
  SELECT v_order_id, (line->>'variant_id')::UUID,
         line->>'product_name_snapshot', line->>'sku_snapshot',
         (line->>'price_snapshot')::NUMERIC, (line->>'quantity')::INT,
         (line->>'total_amount')::NUMERIC, COALESCE(line->'metadata', '{}'::JSONB)
    FROM jsonb_array_elements(v_priced_items) AS line;

  v_reservation := public.reserve_inventory_for_order(v_order_id, v_reservation_items, p_reservation_minutes);
  IF COALESCE((v_reservation->>'success')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'Inventory reservation failed' USING ERRCODE = 'P0001', DETAIL = v_reservation::TEXT;
  END IF;

  INSERT INTO public.payments (order_id, provider, amount, currency, status, method)
  VALUES (
    v_order_id,
    CASE WHEN p_payment_method = 'cod' THEN 'cod' ELSE 'razorpay' END,
    v_subtotal, 'INR', 'pending',
    CASE WHEN p_payment_method = 'cod' THEN 'Cash on Delivery' ELSE 'Online Payment (Razorpay Pending)' END
  );

  -- Preserve the established COD lifecycle: reserve first, then confirm the sale,
  -- which deducts stock_quantity and reserved_quantity exactly once.
  IF p_payment_method = 'cod' THEN
    v_confirmation := public.confirm_inventory_sale_for_order(v_order_id);
    IF COALESCE((v_confirmation->>'success')::BOOLEAN, FALSE) IS NOT TRUE THEN
      RAISE EXCEPTION 'COD inventory confirmation failed' USING ERRCODE = 'P0001', DETAIL = v_confirmation::TEXT;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'order_id', v_order_id, 'order_number', v_order_number);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_order_and_release_inventory(
  p_order_id UUID,
  p_reason TEXT DEFAULT 'order_cancelled',
  p_payment_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_release JSONB;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'ORDER_NOT_FOUND');
  END IF;
  IF v_order.order_status = 'cancelled' AND v_order.reservation_expires_at IS NULL AND (
    EXISTS (SELECT 1 FROM public.inventory_movements WHERE reference_id = p_order_id AND reference_type = 'order' AND movement_type = 'release') OR
    EXISTS (SELECT 1 FROM public.inventory_movements WHERE reference_id = p_order_id AND reference_type = 'order' AND movement_type = 'sale')
  ) THEN
    RETURN jsonb_build_object('success', TRUE, 'order_id', p_order_id, 'status', 'already_cancelled');
  END IF;

  v_release := public.release_inventory_for_order(p_order_id, p_reason);
  IF COALESCE((v_release->>'success')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'Inventory release failed' USING ERRCODE = 'P0001', DETAIL = v_release::TEXT;
  END IF;
  IF v_order.reservation_expires_at IS NOT NULL AND v_release->>'message' = 'Reservation already released for this order.' THEN
    RAISE EXCEPTION 'Active reservation was not released' USING ERRCODE = 'P0001', DETAIL = '{"error":"RESERVATION_RELEASE_FAILED"}';
  END IF;

  UPDATE public.orders
     SET order_status = 'cancelled',
         payment_status = COALESCE(p_payment_status::public.payment_status, payment_status),
         updated_at = NOW()
   WHERE id = p_order_id;
  RETURN jsonb_build_object('success', TRUE, 'order_id', p_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_with_inventory_reservation(JSONB, JSONB, TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_with_inventory_reservation(JSONB, JSONB, TEXT, INT) TO service_role;
REVOKE ALL ON FUNCTION public.cancel_order_and_release_inventory(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order_and_release_inventory(UUID, TEXT, TEXT) TO service_role;
