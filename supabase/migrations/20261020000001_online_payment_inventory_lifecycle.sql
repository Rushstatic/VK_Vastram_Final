-- VK VASTRAM: unpaid online attempts must not reserve storefront stock.
-- COD remains a confirmed order and deducts stock during order creation.
-- Online inventory is checked atomically only after a provider-verified capture.
BEGIN;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS checkout_payment_method TEXT;
UPDATE public.orders o
   SET checkout_payment_method = CASE WHEN EXISTS (
     SELECT 1 FROM public.payments pay WHERE pay.order_id = o.id AND pay.provider = 'cod'
   ) THEN 'cod' ELSE 'online' END
 WHERE checkout_payment_method IS NULL OR checkout_payment_method NOT IN ('online','cod');
ALTER TABLE public.orders ALTER COLUMN checkout_payment_method SET DEFAULT 'online';
ALTER TABLE public.orders ALTER COLUMN checkout_payment_method SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.orders'::regclass AND conname='orders_checkout_payment_method_check') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_checkout_payment_method_check CHECK (checkout_payment_method IN ('online','cod'));
  END IF;
END $$;

-- Fast default admin queue filter without overwriting the independent search OR filter.
-- Explicit Payment Status filters can still reveal failed or pending online attempts.
-- Use a trigger-maintained boolean rather than a generated expression: casting an
-- enum to text may not be accepted as IMMUTABLE by every supported PostgreSQL build.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_admin_queue_visible BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE public.orders
   SET is_admin_queue_visible = (
     checkout_payment_method = 'cod'
     OR payment_status::TEXT IN ('captured','paid','cod_pending','cod_collected','cod_settled')
   );
CREATE OR REPLACE FUNCTION public.sync_order_admin_queue_visibility()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  NEW.is_admin_queue_visible := (
    NEW.checkout_payment_method = 'cod'
    OR NEW.payment_status::TEXT IN ('captured','paid','cod_pending','cod_collected','cod_settled')
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS orders_sync_admin_queue_visibility ON public.orders;
CREATE TRIGGER orders_sync_admin_queue_visibility
  BEFORE INSERT OR UPDATE OF checkout_payment_method, payment_status
  ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.sync_order_admin_queue_visibility();
REVOKE ALL ON FUNCTION public.sync_order_admin_queue_visibility() FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS orders_admin_queue_visible_created_idx
  ON public.orders(is_admin_queue_visible, created_at DESC);

-- Idempotency guard for notifications delivered by both verification and webhooks.
CREATE TABLE IF NOT EXISTS public.order_notification_events (
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('admin_new_order','customer_order_confirmation')),
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','sent','failed')),
  attempt_count INTEGER NOT NULL DEFAULT 1,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (order_id, event_type)
);
ALTER TABLE public.order_notification_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_notification_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.order_notification_events TO service_role;

-- Clear existing temporary holds from old abandoned/failed online attempts. Keep the
-- order/payment records for audit and same-order retries; do not delete customer records.
DO $$
DECLARE v_order RECORD;
BEGIN
  FOR v_order IN
    SELECT o.id
      FROM public.orders o
     WHERE o.checkout_payment_method = 'online'
       AND o.payment_status::TEXT IN ('pending','failed','authorized')
       AND o.order_status::TEXT IN ('pending','pending_payment')
       AND o.reservation_expires_at IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM public.inventory_movements im
          WHERE im.reference_type='order' AND im.reference_id=o.id AND im.movement_type='reservation'
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.inventory_movements im
          WHERE im.reference_type='order' AND im.reference_id=o.id AND im.movement_type IN ('sale','release')
       )
     FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.release_inventory_for_order(v_order.id, 'Released legacy online checkout hold; inventory is only consumed after verified capture');
  END LOOP;

  -- Also clear stale expiry timestamps where a legacy reservation was already released
  -- (or no reservation movement exists). Otherwise the payment endpoint could reject a
  -- same-order retry solely because of an obsolete reservation_expires_at value.
  UPDATE public.orders o
     SET reservation_expires_at = NULL, updated_at = NOW()
   WHERE o.checkout_payment_method = 'online'
     AND o.payment_status::TEXT IN ('pending','failed','authorized')
     AND o.order_status::TEXT IN ('pending','pending_payment')
     AND o.reservation_expires_at IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.inventory_movements im
        WHERE im.reference_type='order' AND im.reference_id=o.id AND im.movement_type='sale'
     );
END $$;

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
  v_line_tax NUMERIC(10,2);
  v_taxable_line NUMERIC(10,2);
  v_tax_rate NUMERIC(5,2);
  v_subtotal NUMERIC(10,2) := 0;
  v_tax_total NUMERIC(10,2) := 0;
  v_priced_items JSONB := '[]'::JSONB;
  v_adjusted_items JSONB := '[]'::JSONB;
  v_reservation_items JSONB := '[]'::JSONB;
  v_reservation JSONB;
  v_confirmation JSONB;
  v_fall_pico_price NUMERIC(10,2) := 0;
  v_free_shipping_threshold NUMERIC(10,2) := 1999;
  v_maharashtra_shipping NUMERIC(10,2) := 100;
  v_other_state_shipping NUMERIC(10,2) := 150;
  v_shipping_amount NUMERIC(10,2) := 0;
  v_destination_state TEXT := '';
  v_include_fall_pico BOOLEAN := FALSE;
  v_coupon RECORD;
  v_coupon_id UUID;
  v_coupon_code TEXT;
  v_discount_amount NUMERIC(10,2) := 0;
  v_coupon_usage_count INTEGER := 0;
  v_user_coupon_count INTEGER := 0;
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

  SELECT
    COALESCE(NULLIF(value->>'fall_pico_price', '')::NUMERIC, 0),
    COALESCE(NULLIF(value->>'free_shipping_threshold', '')::NUMERIC, 1999),
    COALESCE(NULLIF(value->>'maharashtra_shipping', '')::NUMERIC, 100),
    COALESCE(NULLIF(value->>'other_state_shipping', '')::NUMERIC, 150)
  INTO v_fall_pico_price, v_free_shipping_threshold, v_maharashtra_shipping, v_other_state_shipping
  FROM public.site_settings WHERE key = 'general';
  v_fall_pico_price := GREATEST(0, COALESCE(v_fall_pico_price, 0));
  v_free_shipping_threshold := GREATEST(0, COALESCE(v_free_shipping_threshold, 1999));
  v_maharashtra_shipping := GREATEST(0, COALESCE(v_maharashtra_shipping, 100));
  v_other_state_shipping := GREATEST(0, COALESCE(v_other_state_shipping, 150));

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
           pv.stock_quantity, pv.reserved_quantity, pv.is_active, p.name AS product_name, p.price AS product_price, p.gst_rate AS product_gst_rate, p.status::TEXT AS product_status
      INTO v_variant
      FROM public.product_variants pv
      JOIN public.products p ON p.id = pv.product_id
     WHERE pv.id = v_variant_id
     FOR UPDATE OF pv, p;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variant does not exist' USING ERRCODE = 'P0001', DETAIL = '{"error":"VARIANT_NOT_FOUND"}';
    END IF;
    IF v_variant.product_id <> v_product_id THEN
      RAISE EXCEPTION 'Variant does not belong to the selected product' USING ERRCODE = 'P0001', DETAIL = '{"error":"VARIANT_NOT_FOUND"}';
    END IF;
    IF NOT v_variant.is_active OR v_variant.product_status <> 'active' THEN
      RAISE EXCEPTION 'Product or variant is unavailable' USING ERRCODE = 'P0001', DETAIL = '{"error":"PRODUCT_UNAVAILABLE"}';
    END IF;
    IF COALESCE(v_variant.stock_quantity, 0) - COALESCE(v_variant.reserved_quantity, 0) < v_quantity THEN
      RAISE EXCEPTION 'Insufficient available stock for selected variant' USING ERRCODE = 'P0001', DETAIL = '{"error":"INSUFFICIENT_STOCK"}';
    END IF;

    v_include_fall_pico := COALESCE((v_item->'metadata'->>'includeFallPico')::BOOLEAN, FALSE);
    v_price := COALESCE(v_variant.price_override, v_variant.product_price)
      + CASE WHEN v_include_fall_pico THEN v_fall_pico_price ELSE 0 END;
    IF v_price IS NULL OR v_price < 0 OR v_price::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'Product price is invalid' USING ERRCODE = 'P0001', DETAIL = '{"error":"INVALID_PRICE"}';
    END IF;
    v_line_total := ROUND(v_price * v_quantity, 2);
    -- A missing product rate is unknown, not an assumed 0% GST rate.
    v_tax_rate := CASE
      WHEN v_variant.product_gst_rate IS NULL THEN NULL
      ELSE GREATEST(0, LEAST(100, v_variant.product_gst_rate))
    END;
    -- Catalog prices are GST-inclusive: extract the tax component without changing the customer's payable price.
    v_line_tax := CASE WHEN v_tax_rate > 0 THEN ROUND(v_line_total - (v_line_total / (1 + v_tax_rate / 100)), 2) ELSE 0 END;
    v_taxable_line := CASE WHEN v_tax_rate IS NULL THEN NULL ELSE ROUND(v_line_total - v_line_tax, 2) END;
    v_tax_total := v_tax_total + v_line_tax;
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
      'total_amount', v_line_total,
      'gst_rate_snapshot', v_tax_rate,
      'gst_amount_snapshot', v_line_tax,
      'taxable_amount_snapshot', v_taxable_line,
      'include_fall_pico', v_include_fall_pico
    );
    v_priced_items := v_priced_items || jsonb_build_array(v_item);
  END LOOP;

  v_destination_state := LOWER(TRIM(SPLIT_PART(COALESCE(p_order->'shipping_address_snapshot'->>'state', ''), ',', 1)));
  v_destination_state := REGEXP_REPLACE(v_destination_state, '\s+state$', '');
  IF v_free_shipping_threshold > 0 AND v_subtotal >= v_free_shipping_threshold THEN
    v_shipping_amount := 0;
  ELSIF v_destination_state IN ('maharashtra', 'mh', 'maharashtra state', 'state of maharashtra') THEN
    v_shipping_amount := v_maharashtra_shipping;
  ELSE
    v_shipping_amount := v_other_state_shipping;
  END IF;

  v_coupon_code := NULLIF(UPPER(TRIM(COALESCE(p_order->>'coupon_code', ''))), '');
  IF v_coupon_code IS NOT NULL THEN
    SELECT * INTO v_coupon FROM public.coupons
      WHERE code = v_coupon_code AND is_active = TRUE
      FOR UPDATE;
    IF NOT FOUND OR v_coupon.starts_at > NOW() OR (v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < NOW()) THEN
      RAISE EXCEPTION 'Coupon is invalid or expired' USING ERRCODE = 'P0001', DETAIL = '{"error":"COUPON_INVALID"}';
    END IF;
    IF v_subtotal < COALESCE(v_coupon.minimum_order_value, 0) THEN
      RAISE EXCEPTION 'Coupon minimum order value was not met' USING ERRCODE = 'P0001', DETAIL = '{"error":"COUPON_MINIMUM_NOT_MET"}';
    END IF;
    IF v_coupon.usage_limit IS NOT NULL THEN
      SELECT COUNT(*) INTO v_coupon_usage_count
        FROM public.coupon_usage cu JOIN public.orders o ON o.id = cu.order_id
        WHERE cu.coupon_id = v_coupon.id
          AND (o.payment_status = 'captured' OR EXISTS (
            SELECT 1 FROM public.payments pay WHERE pay.order_id = o.id AND pay.provider = 'cod'
          ))
          AND o.order_status <> 'cancelled';
      IF v_coupon_usage_count >= v_coupon.usage_limit THEN
        RAISE EXCEPTION 'Coupon usage limit reached' USING ERRCODE = 'P0001', DETAIL = '{"error":"COUPON_USAGE_LIMIT"}';
      END IF;
    END IF;
    IF v_user_id IS NOT NULL AND v_coupon.per_user_limit IS NOT NULL THEN
      SELECT COUNT(*) INTO v_user_coupon_count
        FROM public.coupon_usage cu JOIN public.orders o ON o.id = cu.order_id
        WHERE cu.coupon_id = v_coupon.id AND cu.user_id = v_user_id
          AND (o.payment_status = 'captured' OR EXISTS (
            SELECT 1 FROM public.payments pay WHERE pay.order_id = o.id AND pay.provider = 'cod'
          ))
          AND o.order_status <> 'cancelled';
      IF v_user_coupon_count >= v_coupon.per_user_limit THEN
        RAISE EXCEPTION 'Coupon per-customer usage limit reached' USING ERRCODE = 'P0001', DETAIL = '{"error":"COUPON_CUSTOMER_LIMIT"}';
      END IF;
    END IF;
    IF v_coupon.discount_type::TEXT = 'percentage' THEN
      v_discount_amount := v_subtotal * v_coupon.discount_value / 100;
    ELSE
      v_discount_amount := v_coupon.discount_value;
    END IF;
    IF v_coupon.maximum_discount IS NOT NULL THEN
      v_discount_amount := LEAST(v_discount_amount, v_coupon.maximum_discount);
    END IF;
    v_discount_amount := ROUND(GREATEST(0, LEAST(v_subtotal, v_discount_amount)), 2);
    v_coupon_id := v_coupon.id;
  END IF;

  -- Catalogue prices are GST-inclusive. A coupon reduces the consideration paid,
  -- so allocate the discount proportionally across lines and recalculate the
  -- GST component on each discounted inclusive line. Confirm this policy with
  -- the store's accountant before applying the migration in production.
  IF v_discount_amount > 0 AND v_subtotal > 0 THEN
    v_tax_total := 0;
    v_adjusted_items := '[]'::JSONB;
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_priced_items)
    LOOP
      v_line_total := ROUND((v_item->>'total_amount')::NUMERIC * (v_subtotal - v_discount_amount) / v_subtotal, 2);
      v_tax_rate := NULLIF(v_item->>'gst_rate_snapshot', '')::NUMERIC;
      v_line_tax := CASE WHEN COALESCE(v_tax_rate, 0) > 0
        THEN ROUND(v_line_total - (v_line_total / (1 + v_tax_rate / 100)), 2) ELSE 0 END;
      v_taxable_line := CASE WHEN v_tax_rate IS NULL THEN NULL ELSE ROUND(v_line_total - v_line_tax, 2) END;
      v_tax_total := v_tax_total + v_line_tax;
      v_adjusted_items := v_adjusted_items || jsonb_build_array(v_item || jsonb_build_object(
        'gst_amount_snapshot', v_line_tax,
        'taxable_amount_snapshot', v_taxable_line
      ));
    END LOOP;
    v_priced_items := v_adjusted_items;
  END IF;

  INSERT INTO public.orders (
    order_number, user_id, customer_name, customer_email, customer_phone, is_guest,
    guest_access_token_hash, shipping_address_snapshot, billing_address_snapshot,
    subtotal, discount_amount, shipping_amount, tax_amount, total_amount, currency,
    checkout_payment_method, payment_status, order_status, notes
  ) VALUES (
    v_order_number, v_user_id, NULLIF(p_order->>'customer_name', ''), NULLIF(p_order->>'customer_email', ''),
    NULLIF(p_order->>'customer_phone', ''), COALESCE((p_order->>'is_guest')::BOOLEAN, v_user_id IS NULL),
    NULLIF(p_order->>'guest_access_token_hash', ''), p_order->'shipping_address_snapshot', p_order->'billing_address_snapshot',
    v_subtotal, v_discount_amount, v_shipping_amount, v_tax_total, GREATEST(0, v_subtotal - v_discount_amount) + v_shipping_amount, 'INR', p_payment_method,
    CASE WHEN p_payment_method = 'cod' THEN 'cod_pending'::public.payment_status ELSE 'pending'::public.payment_status END,
    CASE WHEN p_payment_method = 'cod' THEN 'confirmed'::public.order_status ELSE 'pending'::public.order_status END,
    NULLIF(p_order->>'notes', '')
  ) RETURNING id INTO v_order_id;

  IF v_coupon_id IS NOT NULL THEN
    INSERT INTO public.coupon_usage (coupon_id, user_id, order_id, used_at)
    VALUES (v_coupon_id, v_user_id, v_order_id, NOW());
  END IF;

  INSERT INTO public.order_items (
    order_id, product_variant_id, product_name_snapshot, sku_snapshot,
    price_snapshot, quantity, total_amount, product_metadata_snapshot
  )
  SELECT v_order_id, (line->>'variant_id')::UUID,
         line->>'product_name_snapshot', line->>'sku_snapshot',
         (line->>'price_snapshot')::NUMERIC, (line->>'quantity')::INT,
         (line->>'total_amount')::NUMERIC,
         COALESCE(line->'metadata', '{}'::JSONB) || jsonb_build_object(
           'gstRateSnapshot', (line->>'gst_rate_snapshot')::NUMERIC,
           'gstAmountSnapshot', (line->>'gst_amount_snapshot')::NUMERIC,
           'taxableAmountSnapshot', (line->>'taxable_amount_snapshot')::NUMERIC,
           'includeFallPico', COALESCE((line->>'include_fall_pico')::BOOLEAN, FALSE)
         )
    FROM jsonb_array_elements(v_priced_items) AS line;

  -- COD is an accepted order and consumes stock immediately. Online orders do not
  -- reserve stock while the shopper is inside Razorpay: abandoned checkouts must not
  -- make the last item appear sold out. Stock is atomically checked and deducted only
  -- after the server verifies a captured payment.
  IF p_payment_method = 'cod' THEN
    v_reservation := public.reserve_inventory_for_order(v_order_id, v_reservation_items, p_reservation_minutes);
    IF COALESCE((v_reservation->>'success')::BOOLEAN, FALSE) IS NOT TRUE THEN
      RAISE EXCEPTION 'Inventory reservation failed' USING ERRCODE = 'P0001', DETAIL = v_reservation::TEXT;
    END IF;
  END IF;

  INSERT INTO public.payments (order_id, provider, amount, currency, status, method)
  VALUES (
    v_order_id,
    CASE WHEN p_payment_method = 'cod' THEN 'cod' ELSE 'razorpay' END,
    GREATEST(0, v_subtotal - v_discount_amount) + v_shipping_amount, 'INR', 'pending',
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

CREATE OR REPLACE FUNCTION public.confirm_inventory_sale_for_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item RECORD;
  v_variant_ids UUID[] := '{}';
  v_has_reservation BOOLEAN := FALSE;
  v_expected_count INTEGER := 0;
  v_checked_count INTEGER := 0;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'ORDER_NOT_FOUND', 'message', 'Order not found.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.inventory_movements WHERE reference_id = p_order_id AND reference_type = 'order' AND movement_type = 'sale') THEN
    RETURN jsonb_build_object('success', TRUE, 'message', 'Sale already confirmed for this order.', 'already_confirmed', TRUE);
  END IF;

  v_has_reservation := v_order.reservation_expires_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.inventory_movements WHERE reference_id=p_order_id AND reference_type='order' AND movement_type='reservation')
    AND NOT EXISTS (SELECT 1 FROM public.inventory_movements WHERE reference_id=p_order_id AND reference_type='order' AND movement_type='release');

  SELECT COUNT(*) INTO v_expected_count FROM public.order_items WHERE order_id=p_order_id AND product_variant_id IS NOT NULL;
  SELECT ARRAY_AGG(DISTINCT product_variant_id ORDER BY product_variant_id) INTO v_variant_ids
    FROM public.order_items WHERE order_id=p_order_id AND product_variant_id IS NOT NULL;
  IF COALESCE(v_expected_count,0) = 0 OR v_variant_ids IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'ORDER_ITEMS_MISSING', 'message', 'Order has no valid inventory lines.');
  END IF;

  PERFORM pv.id FROM public.product_variants pv WHERE pv.id = ANY(v_variant_ids) ORDER BY pv.id FOR UPDATE;

  -- Validate every line before changing any stock so a multi-item order cannot be
  -- partially deducted. Online payment captures use unreserved available stock.
  FOR v_item IN
    SELECT oi.product_variant_id, oi.quantity, pv.stock_quantity, pv.reserved_quantity, pv.is_active, p.status::TEXT AS product_status
      FROM public.order_items oi
      JOIN public.product_variants pv ON pv.id = oi.product_variant_id
      JOIN public.products p ON p.id = pv.product_id
     WHERE oi.order_id = p_order_id AND oi.product_variant_id IS NOT NULL
     ORDER BY oi.product_variant_id
  LOOP
    v_checked_count := v_checked_count + 1;
    IF NOT v_item.is_active OR v_item.product_status <> 'active' THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'PRODUCT_UNAVAILABLE', 'variant_id', v_item.product_variant_id, 'inventory_confirmed', FALSE);
    END IF;
    IF v_has_reservation THEN
      IF COALESCE(v_item.stock_quantity,0) < v_item.quantity OR COALESCE(v_item.reserved_quantity,0) < v_item.quantity THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'RESERVATION_INVALID', 'variant_id', v_item.product_variant_id, 'inventory_confirmed', FALSE);
      END IF;
    ELSE
      IF COALESCE(v_item.stock_quantity,0) - COALESCE(v_item.reserved_quantity,0) < v_item.quantity THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'INSUFFICIENT_STOCK', 'variant_id', v_item.product_variant_id, 'inventory_confirmed', FALSE);
      END IF;
    END IF;
  END LOOP;

  IF v_checked_count <> v_expected_count THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'VARIANT_NOT_FOUND', 'inventory_confirmed', FALSE);
  END IF;

  FOR v_item IN
    SELECT product_variant_id, quantity FROM public.order_items
     WHERE order_id=p_order_id AND product_variant_id IS NOT NULL ORDER BY product_variant_id
  LOOP
    UPDATE public.product_variants
       SET stock_quantity = stock_quantity - v_item.quantity,
           reserved_quantity = CASE WHEN v_has_reservation THEN reserved_quantity - v_item.quantity ELSE reserved_quantity END,
           updated_at = NOW()
     WHERE id = v_item.product_variant_id;

    INSERT INTO public.inventory_movements(product_variant_id,movement_type,quantity,reference_type,reference_id,notes)
    VALUES (v_item.product_variant_id,'sale',v_item.quantity,'order',p_order_id,
      CASE WHEN v_has_reservation THEN 'Verified order converted from reservation to sale' ELSE 'Verified online payment; available inventory deducted' END);
  END LOOP;

  UPDATE public.orders SET reservation_expires_at=NULL, updated_at=NOW() WHERE id=p_order_id;
  RETURN jsonb_build_object('success', TRUE, 'order_id', p_order_id, 'inventory_confirmed', TRUE);
END;
$$;

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
  v_refund_note TEXT := 'Payment captured but order could not be fulfilled; refund/manual review required.';
BEGIN
  IF p_order_id IS NULL OR NULLIF(p_provider_order_id,'') IS NULL OR NULLIF(p_provider_payment_id,'') IS NULL THEN
    RAISE EXCEPTION 'Payment reconciliation identifiers are required' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found for payment reconciliation' USING ERRCODE='P0002'; END IF;

  SELECT * INTO v_payment FROM public.payments
   WHERE order_id=p_order_id AND provider_order_id=p_provider_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Persisted Razorpay payment attempt does not match this order' USING ERRCODE='P0001'; END IF;
  IF v_payment.provider_payment_id IS NOT NULL AND v_payment.provider_payment_id <> p_provider_payment_id THEN
    RAISE EXCEPTION 'Razorpay payment ID does not match the persisted payment attempt' USING ERRCODE='P0001';
  END IF;

  -- If another distinct attempt already captured this order, preserve both facts but
  -- flag the second capture for refund review instead of replacing the first proof.
  IF v_order.payment_status::TEXT IN ('captured','paid') AND v_payment.status::TEXT NOT IN ('captured','paid') THEN
    SELECT * INTO v_other_captured FROM public.payments
     WHERE order_id=p_order_id AND status::TEXT IN ('captured','paid')
       AND provider_payment_id IS DISTINCT FROM p_provider_payment_id
     ORDER BY verified_at NULLS LAST, created_at LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      UPDATE public.payments SET status='captured',provider_payment_id=p_provider_payment_id,
        provider_signature=COALESCE(p_provider_signature,provider_signature),verified_at=COALESCE(verified_at,NOW()),
        updated_at=NOW(),method=COALESCE(method,'Razorpay Online') WHERE id=v_payment.id;
      UPDATE public.orders SET refund_status='pending', updated_at=NOW() WHERE id=p_order_id AND refund_status <> 'completed';
      RETURN jsonb_build_object('success',TRUE,'refund_required',TRUE,'duplicate_capture',TRUE,'order_status',v_order.order_status::TEXT,'inventory_confirmed',FALSE);
    END IF;
  END IF;

  UPDATE public.payments SET status='captured',provider_payment_id=p_provider_payment_id,
    provider_signature=COALESCE(p_provider_signature,provider_signature),verified_at=COALESCE(verified_at,NOW()),
    updated_at=NOW(),method=COALESCE(method,'Razorpay Online') WHERE id=v_payment.id;

  IF v_order.order_status::TEXT='cancelled' THEN
    UPDATE public.orders SET payment_status='captured',refund_status='pending',
      notes=concat_ws(' | ',NULLIF(notes,''),v_refund_note),updated_at=NOW()
     WHERE id=p_order_id AND refund_status <> 'completed';
    RETURN jsonb_build_object('success',TRUE,'refund_required',TRUE,'order_status','cancelled','inventory_confirmed',FALSE);
  END IF;

  -- Keep fulfilment unconfirmed until inventory has been atomically checked and sold.
  v_inventory_result := public.confirm_inventory_sale_for_order(p_order_id);
  IF COALESCE((v_inventory_result->>'success')::BOOLEAN,FALSE) IS NOT TRUE THEN
    IF v_order.reservation_expires_at IS NOT NULL THEN
      PERFORM public.release_inventory_for_order(p_order_id,'Captured payment could not be fulfilled; release reserved stock for refund review');
    END IF;
    UPDATE public.orders SET payment_status='captured',order_status='cancelled',refund_status='pending',
      notes=concat_ws(' | ',NULLIF(notes,''),v_refund_note || ' Reason: ' || COALESCE(v_inventory_result->>'error','inventory_unavailable')),
      updated_at=NOW()
     WHERE id=p_order_id AND refund_status <> 'completed';
    RETURN jsonb_build_object('success',TRUE,'refund_required',TRUE,'order_status','cancelled','inventory_confirmed',FALSE,
      'inventory_error',COALESCE(v_inventory_result->>'error','INVENTORY_UNAVAILABLE'));
  END IF;

  UPDATE public.orders SET payment_status='captured',
    order_status=CASE WHEN order_status::TEXT IN ('pending','pending_payment') THEN 'confirmed'::public.order_status ELSE order_status END,
    reservation_expires_at=NULL,updated_at=NOW()
   WHERE id=p_order_id;

  RETURN jsonb_build_object('success',TRUE,'refund_required',FALSE,
    'order_status',CASE WHEN v_order.order_status::TEXT IN ('pending','pending_payment') THEN 'confirmed' ELSE v_order.order_status::TEXT END,
    'inventory_confirmed',TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_inventory_sale_for_order(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_inventory_sale_for_order(UUID) TO service_role;
ALTER FUNCTION public.confirm_inventory_sale_for_order(UUID) SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL ON FUNCTION public.reconcile_captured_payment_for_order(UUID,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_captured_payment_for_order(UUID,TEXT,TEXT,TEXT) TO service_role;
ALTER FUNCTION public.reconcile_captured_payment_for_order(UUID,TEXT,TEXT,TEXT) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.create_order_with_inventory_reservation(JSONB,JSONB,TEXT,INT) SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL ON FUNCTION public.create_order_with_inventory_reservation(JSONB,JSONB,TEXT,INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_with_inventory_reservation(JSONB,JSONB,TEXT,INT) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
