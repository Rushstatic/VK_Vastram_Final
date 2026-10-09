-- =====================================================================
-- VK VASTRAM INVENTORY CONCURRENCY, RESERVATION & COMMERCE HARDENING
-- Migration: 20261005000007_inventory_reservation_hardening.sql
-- =====================================================================

-- 1. Add reservation_expires_at column to public.orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMPTZ;

-- 2. Index on reservation_expires_at for fast cleanup queries
CREATE INDEX IF NOT EXISTS idx_orders_reservation_expires_at
  ON public.orders(reservation_expires_at);

-- 3. Ensure check constraints on product_variants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'product_variants' AND constraint_name = 'chk_stock_quantity_non_negative'
  ) THEN
    ALTER TABLE public.product_variants
      ADD CONSTRAINT chk_stock_quantity_non_negative CHECK (stock_quantity >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'product_variants' AND constraint_name = 'chk_reserved_quantity_non_negative'
  ) THEN
    ALTER TABLE public.product_variants
      ADD CONSTRAINT chk_reserved_quantity_non_negative CHECK (reserved_quantity >= 0);
  END IF;
END $$;

-- =====================================================================
-- 4. ATOMIC INVENTORY RESERVATION STORED PROCEDURE
-- Lock variants deterministically by ID (FOR UPDATE ORDER BY ID)
-- All-or-Nothing transactional stock reservation
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
BEGIN
  -- Validate inputs
  IF p_order_id IS NULL OR p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ARGUMENTS', 'message', 'Order ID and items array are required.');
  END IF;

  -- Extract and sort variant IDs deterministically to prevent deadlocks
  SELECT ARRAY_AGG(DISTINCT (item->>'variant_id')::UUID ORDER BY (item->>'variant_id')::UUID)
  INTO v_variant_ids
  FROM jsonb_array_elements(p_items) AS item
  WHERE item->>'variant_id' IS NOT NULL AND item->>'variant_id' != '';

  IF v_variant_ids IS NULL OR array_length(v_variant_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_VARIANTS', 'message', 'No valid product variant IDs provided.');
  END IF;

  -- Lock all required variant rows in deterministic order
  PERFORM id, stock_quantity, reserved_quantity
  FROM public.product_variants
  WHERE id = ANY(v_variant_ids)
  FOR UPDATE;

  -- Validate available stock for EVERY item in the order before making changes (All-or-Nothing)
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

  -- All items are available! Reserve stock atomically for all items
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
      'Inventory reserved for order checkout'
    );
  END LOOP;

  -- Set reservation expiration timestamp on order
  v_expires_at := NOW() + (COALESCE(p_reservation_minutes, 15) || ' minutes')::INTERVAL;

  UPDATE public.orders
  SET reservation_expires_at = v_expires_at,
      updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'reservation_expires_at', v_expires_at
  );
END;
$$;

-- =====================================================================
-- 5. CONFIRM INVENTORY SALE STORED PROCEDURE
-- Converts reservation to completed sale (Deducts stock_quantity & reserved_quantity)
-- Idempotent: safe against duplicate webhook or verification calls
-- =====================================================================
CREATE OR REPLACE FUNCTION public.confirm_inventory_sale_for_order(
  p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
  v_order RECORD;
  v_variant_ids UUID[] := '{}';
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND', 'message', 'Order not found.');
  END IF;

  -- Idempotency check: Check if inventory sale was already recorded for this order
  IF EXISTS (
    SELECT 1 FROM public.inventory_movements
    WHERE reference_id = p_order_id AND reference_type = 'order' AND movement_type = 'sale'
  ) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Sale already confirmed for this order.');
  END IF;

  -- Collect and lock variant IDs
  SELECT ARRAY_AGG(DISTINCT product_variant_id ORDER BY product_variant_id)
  INTO v_variant_ids
  FROM public.order_items
  WHERE order_id = p_order_id AND product_variant_id IS NOT NULL;

  IF v_variant_ids IS NOT NULL AND array_length(v_variant_ids, 1) > 0 THEN
    PERFORM id FROM public.product_variants WHERE id = ANY(v_variant_ids) FOR UPDATE;

    FOR v_item IN SELECT product_variant_id, quantity FROM public.order_items WHERE order_id = p_order_id AND product_variant_id IS NOT NULL
    LOOP
      -- Convert reservation to sale: decrement stock_quantity and reserved_quantity
      UPDATE public.product_variants
      SET
        stock_quantity = GREATEST(0, stock_quantity - v_item.quantity),
        reserved_quantity = GREATEST(0, reserved_quantity - v_item.quantity),
        updated_at = NOW()
      WHERE id = v_item.product_variant_id;

      INSERT INTO public.inventory_movements (
        product_variant_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        notes
      ) VALUES (
        v_item.product_variant_id,
        'sale',
        v_item.quantity,
        'order',
        p_order_id,
        'Order confirmed and inventory sale recorded'
      );
    END LOOP;
  END IF;

  -- Clear reservation expiration timestamp
  UPDATE public.orders
  SET reservation_expires_at = NULL,
      updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id);
END;
$$;

-- =====================================================================
-- 6. RELEASE INVENTORY STORED PROCEDURE
-- Releases reserved stock back to available pool
-- Idempotent: safe against duplicate cancellation calls
-- =====================================================================
CREATE OR REPLACE FUNCTION public.release_inventory_for_order(
  p_order_id UUID,
  p_reason TEXT DEFAULT 'order_cancelled'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
  v_order RECORD;
  v_variant_ids UUID[] := '{}';
  v_released_count INT := 0;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND', 'message', 'Order not found.');
  END IF;

  -- Idempotency check: If sale was already completed, release cannot un-reserve a completed sale.
  IF EXISTS (
    SELECT 1 FROM public.inventory_movements
    WHERE reference_id = p_order_id AND reference_type = 'order' AND movement_type = 'sale'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_SOLD', 'message', 'Cannot release reservation for an order that has already been converted to a completed sale.');
  END IF;

  -- Check if already released
  IF EXISTS (
    SELECT 1 FROM public.inventory_movements
    WHERE reference_id = p_order_id AND reference_type = 'order' AND movement_type = 'release'
  ) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Reservation already released for this order.');
  END IF;

  -- Collect and lock variant IDs
  SELECT ARRAY_AGG(DISTINCT product_variant_id ORDER BY product_variant_id)
  INTO v_variant_ids
  FROM public.order_items
  WHERE order_id = p_order_id AND product_variant_id IS NOT NULL;

  IF v_variant_ids IS NOT NULL AND array_length(v_variant_ids, 1) > 0 THEN
    PERFORM id FROM public.product_variants WHERE id = ANY(v_variant_ids) FOR UPDATE;

    FOR v_item IN SELECT product_variant_id, quantity FROM public.order_items WHERE order_id = p_order_id AND product_variant_id IS NOT NULL
    LOOP
      UPDATE public.product_variants
      SET reserved_quantity = GREATEST(0, reserved_quantity - v_item.quantity),
          updated_at = NOW()
      WHERE id = v_item.product_variant_id;

      INSERT INTO public.inventory_movements (
        product_variant_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        notes
      ) VALUES (
        v_item.product_variant_id,
        'release',
        v_item.quantity,
        'order',
        p_order_id,
        COALESCE(p_reason, 'Inventory reservation released')
      );
      v_released_count := v_released_count + 1;
    END LOOP;
  END IF;

  UPDATE public.orders
  SET reservation_expires_at = NULL,
      updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'released_items_count', v_released_count);
END;
$$;

-- =====================================================================
-- 7. RECONCILE EXPIRED RESERVATIONS STORED PROCEDURE
-- Releases reservations for pending orders past reservation_expires_at
-- =====================================================================
CREATE OR REPLACE FUNCTION public.reconcile_expired_reservations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expired_order RECORD;
  v_reconciled_count INT := 0;
BEGIN
  FOR v_expired_order IN
    SELECT id, order_number FROM public.orders
    WHERE reservation_expires_at IS NOT NULL
      AND reservation_expires_at < NOW()
      AND payment_status = 'pending'
      AND order_status = 'pending'
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.release_inventory_for_order(v_expired_order.id, 'Reservation expired due to payment timeout');
    
    UPDATE public.orders
    SET order_status = 'cancelled',
        notes = COALESCE(notes || ' | ', '') || 'Order cancelled automatically due to payment reservation timeout',
        updated_at = NOW()
    WHERE id = v_expired_order.id;

    v_reconciled_count := v_reconciled_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'reconciled_count', v_reconciled_count);
END;
$$;

-- =====================================================================
-- 8. CUSTOMER RETURN RESTOCK STORED PROCEDURE
-- Restocks physical inventory and logs 'return' movement
-- =====================================================================
CREATE OR REPLACE FUNCTION public.return_inventory_for_order_item(
  p_order_id UUID,
  p_product_variant_id UUID,
  p_quantity INT,
  p_reason TEXT DEFAULT 'customer return restock'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_product_variant_id IS NULL OR p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ARGUMENTS', 'message', 'Variant ID and positive quantity are required.');
  END IF;

  PERFORM id FROM public.product_variants WHERE id = p_product_variant_id FOR UPDATE;

  UPDATE public.product_variants
  SET stock_quantity = stock_quantity + p_quantity,
      updated_at = NOW()
  WHERE id = p_product_variant_id;

  INSERT INTO public.inventory_movements (
    product_variant_id,
    movement_type,
    quantity,
    reference_type,
    reference_id,
    notes
  ) VALUES (
    p_product_variant_id,
    'return',
    p_quantity,
    'order',
    p_order_id,
    COALESCE(p_reason, 'Customer return restock')
  );

  RETURN jsonb_build_object('success', true, 'product_variant_id', p_product_variant_id, 'restocked_quantity', p_quantity);
END;
$$;
