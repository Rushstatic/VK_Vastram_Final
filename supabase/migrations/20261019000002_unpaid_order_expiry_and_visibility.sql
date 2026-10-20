-- =====================================================================
-- Unpaid / abandoned online orders: release stock, never leave "pending" forever
--
-- Problem: a customer starts online payment, then closes the page or the payment
-- popup. The order stayed "pending" and the saree stayed reserved, so a 1-piece
-- saree showed "Sold out" to everyone. Causes:
--   * reconcile_expired_reservations() was never scheduled or called by anything;
--   * it ignored orders whose payment_status had already become 'failed';
--   * it left payment_status = 'pending' on the cancelled order.
--
-- Standard rules implemented here:
--   1. Online orders HOLD stock only for a short window (reservation_expires_at).
--      stock_quantity is deducted only when payment is confirmed (existing flow).
--   2. When the hold ends, or the customer closes the payment window, the order is
--      cancelled with payment_status = 'failed' and the hold is released.
--   3. Confirmed = paid online, or Cash on Delivery. COD is confirmed on creation
--      and is NEVER touched by this expiry.
--   4. A payment that was captured/authorized is never expired or released.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Atomically abandon ONE unpaid online order (used by the sweeper and by the
--    "customer closed the payment window" API).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.abandon_unpaid_order(
  p_order_id UUID,
  p_reason TEXT DEFAULT 'Payment not completed'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_release JSONB;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'ORDER_NOT_FOUND');
  END IF;

  -- Only an open, unpaid, online order can be abandoned.
  IF v_order.order_status::TEXT <> 'pending' OR v_order.payment_status::TEXT NOT IN ('pending', 'failed') THEN
    RETURN jsonb_build_object('success', TRUE, 'abandoned', FALSE, 'reason', 'not_an_open_unpaid_order');
  END IF;

  IF EXISTS (SELECT 1 FROM public.payments p WHERE p.order_id = p_order_id AND p.provider = 'cod') THEN
    RETURN jsonb_build_object('success', TRUE, 'abandoned', FALSE, 'reason', 'cash_on_delivery_order');
  END IF;

  -- Never release stock for money that has been (or is about to be) taken.
  IF EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.order_id = p_order_id AND p.status::TEXT IN ('captured', 'authorized')
  ) THEN
    RETURN jsonb_build_object('success', TRUE, 'abandoned', FALSE, 'reason', 'payment_in_progress_or_captured');
  END IF;

  v_release := public.release_inventory_for_order(p_order_id, COALESCE(p_reason, 'Payment not completed'));
  IF COALESCE(v_release->>'error', '') = 'ALREADY_SOLD' THEN
    RETURN jsonb_build_object('success', TRUE, 'abandoned', FALSE, 'reason', 'already_sold');
  END IF;
  IF COALESCE((v_release->>'success')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'RELEASE_FAILED', 'detail', v_release);
  END IF;

  UPDATE public.orders
  SET order_status = 'cancelled',
      payment_status = 'failed',
      reservation_expires_at = NULL,
      notes = CASE WHEN COALESCE(notes, '') = '' THEN COALESCE(p_reason, 'Payment not completed')
                   ELSE notes || ' | ' || COALESCE(p_reason, 'Payment not completed') END,
      updated_at = NOW()
  WHERE id = p_order_id;

  UPDATE public.payments
  SET status = 'failed', updated_at = NOW()
  WHERE order_id = p_order_id AND status::TEXT = 'pending';

  RETURN jsonb_build_object('success', TRUE, 'abandoned', TRUE, 'order_id', p_order_id);
END;
$$;

-- ---------------------------------------------------------------------
-- 2. Sweeper: abandon every unpaid online order whose hold has ended.
--    Safe to run every minute and from several places at once.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_unpaid_orders(
  p_grace_minutes INT DEFAULT 3,     -- wait a little after the hold ends so a delayed payment webhook can arrive
  p_stale_minutes INT DEFAULT 30     -- orders with NO hold at all: abandon after this many minutes
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_result JSONB;
  v_count INT := 0;
BEGIN
  FOR v_order IN
    SELECT o.id
    FROM public.orders o
    WHERE o.order_status::TEXT = 'pending'
      AND o.payment_status::TEXT IN ('pending', 'failed')
      AND (
        (o.reservation_expires_at IS NOT NULL
          AND o.reservation_expires_at < NOW() - make_interval(mins => GREATEST(0, p_grace_minutes)))
        OR
        (o.reservation_expires_at IS NULL
          AND o.created_at < NOW() - make_interval(mins => GREATEST(1, p_stale_minutes)))
      )
    ORDER BY o.created_at
    LIMIT 500
    FOR UPDATE OF o SKIP LOCKED
  LOOP
    v_result := public.abandon_unpaid_order(v_order.id, 'Payment not completed: checkout hold expired');
    IF COALESCE((v_result->>'abandoned')::BOOLEAN, FALSE) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', TRUE, 'expired_count', v_count, 'reconciled_count', v_count);
END;
$$;

-- Keep the original function name working (it is referenced by older code/tests),
-- but make it use the robust logic above.
CREATE OR REPLACE FUNCTION public.reconcile_expired_reservations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.expire_unpaid_orders();
END;
$$;

-- ---------------------------------------------------------------------
-- 3. Any cancellation of an unpaid ONLINE order must read as a failed payment,
--    never as a "pending" payment (so it can never be mistaken for a live order).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_cancelled_unpaid_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_status::TEXT = 'cancelled' AND NEW.payment_status::TEXT = 'pending'
     AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.order_id = NEW.id AND p.provider = 'cod') THEN
    NEW.payment_status := 'failed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_cancelled_unpaid_order ON public.orders;
CREATE TRIGGER trg_normalize_cancelled_unpaid_order
BEFORE UPDATE OF order_status, payment_status ON public.orders
FOR EACH ROW
WHEN (NEW.order_status::TEXT = 'cancelled' AND NEW.payment_status::TEXT = 'pending')
EXECUTE FUNCTION public.normalize_cancelled_unpaid_order();

-- Helps the sweeper and the admin "awaiting payment" view.
CREATE INDEX IF NOT EXISTS orders_unpaid_online_expiry_idx
  ON public.orders (reservation_expires_at)
  WHERE order_status = 'pending' AND payment_status IN ('pending', 'failed');

-- ---------------------------------------------------------------------
-- 4. Permissions: server (service role) only. Never callable with the public key.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.abandon_unpaid_order(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_unpaid_orders(INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_expired_reservations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.abandon_unpaid_order(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_unpaid_orders(INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_expired_reservations() TO service_role;

-- ---------------------------------------------------------------------
-- 5. One-time cleanup of orders that are ALREADY stuck (this is what frees the
--    1-piece saree that is currently showing "Sold out").
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_result JSONB;
BEGIN
  v_result := public.expire_unpaid_orders(0, 30);
  RAISE NOTICE 'Released stuck unpaid orders: %', v_result;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Release of stuck unpaid orders was skipped: %', SQLERRM;
END;
$$;

-- Old cancelled online orders that still read "pending" payment (separate block so a
-- problem here can never undo the stock release above).
DO $$
BEGIN
  UPDATE public.orders o
  SET payment_status = 'failed'
  WHERE o.order_status::TEXT = 'cancelled'
    AND o.payment_status::TEXT = 'pending'
    AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.order_id = o.id AND p.provider = 'cod')
    AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.order_id = o.id AND p.status::TEXT IN ('captured', 'authorized'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Normalising old cancelled orders was skipped: %', SQLERRM;
END;
$$;

-- ---------------------------------------------------------------------
-- 6. Optional database-side schedule (every minute) when pg_cron is available.
--    The app server also runs the sweeper, so this is a second safety net.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    BEGIN
      PERFORM cron.unschedule('vk_expire_unpaid_orders');
    EXCEPTION WHEN OTHERS THEN
      NULL; -- job did not exist yet
    END;
    PERFORM cron.schedule('vk_expire_unpaid_orders', '* * * * *', 'SELECT public.expire_unpaid_orders();');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron schedule not created (%). The app server sweeper will release expired holds.', SQLERRM;
END;
$$;
