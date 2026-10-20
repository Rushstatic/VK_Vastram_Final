-- =====================================================================
-- VK VASTRAM DATABASE-AUTHORITATIVE INVENTORY CONCURRENCY HARDENING
-- Migration: 20261005000008_database_authoritative_inventory.sql
-- =====================================================================

-- 1. HARDENED ATOMIC INVENTORY RESERVATION
-- Added idempotency: skip re-reservation if a valid reservation exists for the same order.
-- Added automatic cleanup: release expired reservation before re-reserving if necessary.
-- deterministic locking order preserved.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.reserve_inventory_for_order(
  p_order_id UUID,
  p_items JSONB, -- Array of {"variant_id": "...", "quantity": 2}
  p_reservation_minutes INT DEFAULT 15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item JSONB;
  v_variant_id UUID;
  v_qty INT;
  v_stock INT;
  v_reserved INT;
  v_available INT;
  v_variant_ids UUID[] := '{}';
  v_expires_at TIMESTAMPTZ;
  v_current_expires_at TIMESTAMPTZ;
  v_order_exists BOOLEAN;
BEGIN
  -- 1. Validate inputs
  IF p_order_id IS NULL OR p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ARGUMENTS', 'message', 'Order ID and items array are required.');
  END IF;

  -- 2. Lock Order row and check existing reservation status
  SELECT reservation_expires_at INTO v_current_expires_at 
  FROM public.orders 
  WHERE id = p_order_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND', 'message', 'Order not found.');
  END IF;

  -- 3. IDEMPOTENCY: If order already has a VALID (non-expired) reservation, return success immediately.
  -- This prevents double-decrementing stock/double-incrementing reserved_quantity during retries.
  IF v_current_expires_at IS NOT NULL AND v_current_expires_at > NOW() THEN
    RETURN jsonb_build_object(
      'success', true, 
      'order_id', p_order_id, 
      'reservation_expires_at', v_current_expires_at,
      'status', 'already_reserved'
    );
  END IF;

  -- 4. CLEANUP: If there was an expired reservation, release it first before re-reserving.
  -- This ensures the math (stock - reserved) remains correct.
  IF v_current_expires_at IS NOT NULL AND v_current_expires_at <= NOW() THEN
    PERFORM public.release_inventory_for_order(p_order_id, 're-reserving expired order');
  END IF;

  -- 5. Extract and sort variant IDs deterministically to prevent deadlocks
  SELECT ARRAY_AGG(DISTINCT (item->>'variant_id')::UUID ORDER BY (item->>'variant_id')::UUID)
  INTO v_variant_ids
  FROM jsonb_array_elements(p_items) AS item
  WHERE item->>'variant_id' IS NOT NULL AND item->>'variant_id' != '';

  IF v_variant_ids IS NULL OR array_length(v_variant_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_VARIANTS', 'message', 'No valid product variant IDs provided.');
  END IF;

  -- 6. Lock all required variant rows in deterministic order
  PERFORM id, stock_quantity, reserved_quantity
  FROM public.product_variants
  WHERE id = ANY(v_variant_ids)
  FOR UPDATE;

  -- 7. Validate available stock for EVERY item (All-or-Nothing)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_variant_id := (v_item->>'variant_id')::UUID;
    v_qty := (v_item->>'quantity')::INT;

    IF v_variant_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'INVALID_QUANTITY', 'message', 'Invalid item quantity requested.');
    END IF;

    SELECT stock_quantity, reserved_quantity
    INTO v_stock, v_reserved
    FROM public.product_variants
    WHERE id = v_variant_id;

    IF v_stock IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'VARIANT_NOT_FOUND', 'message', 'Product variant does not exist.');
    END IF;

    v_available := v_stock - v_reserved;

    IF v_available < v_qty THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INSUFFICIENT_STOCK',
        'message', 'One or more items are no longer available in the requested quantity.',
        'out_of_stock_variant_id', v_variant_id,
        'requested_quantity', v_qty,
        'available_quantity', GREATEST(0, v_available)
      );
    END IF;
  END LOOP;

  -- 8. Perform reservation
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_variant_id := (v_item->>'variant_id')::UUID;
    v_qty := (v_item->>'quantity')::INT;

    UPDATE public.product_variants
    SET reserved_quantity = reserved_quantity + v_qty,
        updated_at = NOW()
    WHERE id = v_variant_id;

    INSERT INTO public.inventory_movements (
      product_variant_id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      notes
    ) VALUES (
      v_variant_id,
      'reservation',
      v_qty,
      'order',
      p_order_id,
      'Inventory reserved authoritatively by database'
    );
  END LOOP;

  -- 9. Set expiration
  v_expires_at := NOW() + (COALESCE(p_reservation_minutes, 15) || ' minutes')::INTERVAL;

  UPDATE public.orders
  SET reservation_expires_at = v_expires_at,
      updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'reservation_expires_at', v_expires_at,
    'status', 'new_reservation'
  );
END;
$$;
