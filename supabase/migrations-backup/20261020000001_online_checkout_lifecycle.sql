-- Online checkout lifecycle: paid-only confirmation, failure release, expiry cleanup,
-- production scheduling, and an auditable one-time legacy reconciliation.
BEGIN;

-- The runtime enum predates a terminal abandoned state. Add it only when missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'order_status' AND e.enumlabel = 'abandoned'
  ) THEN
    ALTER TYPE public.order_status ADD VALUE 'abandoned';
  END IF;
END $$;

-- Record each automated transition without deleting order, payment, or inventory history.
CREATE TABLE IF NOT EXISTS public.checkout_reconciliation_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('payment_failed', 'reservation_expired', 'legacy_backfill')),
  previous_payment_status text NOT NULL,
  previous_order_status text NOT NULL,
  released_items_count integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checkout_reconciliation_audit_order_idx
  ON public.checkout_reconciliation_audit(order_id, created_at DESC);
REVOKE ALL ON public.checkout_reconciliation_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.checkout_reconciliation_audit TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.checkout_reconciliation_audit_id_seq TO service_role;

CREATE TABLE IF NOT EXISTS public.order_confirmation_notifications (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE RESTRICT,
  payment_stage text NOT NULL CHECK (payment_stage IN ('online', 'cod')),
  claimed_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.order_confirmation_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.order_confirmation_notifications TO service_role;

-- A failure callback updates the exact attempt and releases inventory only when no
-- sibling Razorpay attempt remains eligible to capture. The order lock serializes
-- this with capture and expiry reconciliation.
CREATE OR REPLACE FUNCTION public.reconcile_failed_payment_attempt(
  p_order_id uuid,
  p_provider_order_id text,
  p_error_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_release jsonb;
  v_other_pending boolean;
  v_released_count integer := 0;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND'); END IF;
  SELECT * INTO v_payment FROM public.payments
   WHERE order_id = p_order_id AND provider_order_id = p_provider_order_id FOR UPDATE;
  IF NOT FOUND OR v_payment.provider <> 'razorpay' THEN
    RETURN jsonb_build_object('success', false, 'error', 'PAYMENT_ATTEMPT_NOT_FOUND');
  END IF;
  IF v_payment.status::text IN ('captured', 'paid', 'succeeded') OR v_order.payment_status::text IN ('captured', 'paid')
     OR EXISTS (SELECT 1 FROM public.inventory_movements WHERE reference_id = p_order_id AND reference_type = 'order' AND movement_type = 'sale') THEN
    RETURN jsonb_build_object('success', true, 'unchanged', true, 'payment_status', v_order.payment_status::text);
  END IF;

  UPDATE public.payments SET status = 'failed'::public.payment_status,
    error_reason = left(COALESCE(NULLIF(p_error_reason, ''), 'Payment failed at gateway'), 500), updated_at = now()
   WHERE id = v_payment.id;

  SELECT EXISTS (SELECT 1 FROM public.payments
    WHERE order_id = p_order_id AND provider = 'razorpay' AND status::text = 'pending') INTO v_other_pending;

  IF v_order.order_status::text IN ('pending', 'pending_payment') AND v_order.reservation_expires_at IS NOT NULL
     AND NOT v_other_pending THEN
    v_release := public.release_inventory_for_order(p_order_id, 'Razorpay payment attempt failed');
    IF COALESCE((v_release->>'success')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Inventory release failed after payment failure: %', COALESCE(v_release::text, '{}');
    END IF;
    v_released_count := COALESCE((v_release->>'released_items_count')::integer, 0);
    UPDATE public.orders SET order_status = 'cancelled', payment_status = 'failed'::public.payment_status,
      cancelled_at = now(), cancellation_reason = 'Payment attempt failed', updated_at = now()
     WHERE id = p_order_id;
    INSERT INTO public.checkout_reconciliation_audit(order_id,event_type,previous_payment_status,previous_order_status,released_items_count,details)
    VALUES (p_order_id,'payment_failed',v_order.payment_status::text,v_order.order_status::text,v_released_count,
      jsonb_build_object('provider_order_id',p_provider_order_id));
    RETURN jsonb_build_object('success', true, 'released', true, 'order_status', 'cancelled');
  END IF;

  UPDATE public.orders SET payment_status = 'failed'::public.payment_status, updated_at = now()
   WHERE id = p_order_id AND payment_status::text NOT IN ('captured', 'paid');
  INSERT INTO public.checkout_reconciliation_audit(order_id,event_type,previous_payment_status,previous_order_status,released_items_count,details)
  VALUES (p_order_id,'payment_failed',v_order.payment_status::text,v_order.order_status::text,0,
    jsonb_build_object('provider_order_id',p_provider_order_id,'reservation_retained',v_other_pending));
  RETURN jsonb_build_object('success', true, 'released', false, 'reservation_retained', v_other_pending);
END;
$$;
REVOKE ALL ON FUNCTION public.reconcile_failed_payment_attempt(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_failed_payment_attempt(uuid,text,text) TO service_role;

-- A capture after reservation release remains financially visible and is sent to
-- refund review. It never resurrects an abandoned/cancelled checkout or consumes stock.
CREATE OR REPLACE FUNCTION public.reconcile_captured_payment_for_order(
  p_order_id uuid,
  p_provider_order_id text,
  p_provider_payment_id text,
  p_provider_signature text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_other_captured public.payments%ROWTYPE;
  v_inventory_result jsonb;
BEGIN
  IF p_order_id IS NULL OR NULLIF(p_provider_order_id,'') IS NULL OR NULLIF(p_provider_payment_id,'') IS NULL THEN
    RAISE EXCEPTION 'Payment reconciliation identifiers are required' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found for payment reconciliation' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_payment FROM public.payments WHERE order_id=p_order_id AND provider_order_id=p_provider_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Persisted Razorpay payment attempt does not match this order' USING ERRCODE='P0001'; END IF;
  IF v_payment.provider_payment_id IS NOT NULL AND v_payment.provider_payment_id<>p_provider_payment_id THEN
    RAISE EXCEPTION 'Razorpay payment ID does not match the persisted payment attempt' USING ERRCODE='P0001';
  END IF;
  IF v_order.payment_status::text='captured' AND v_payment.status::text<>'captured' THEN
    SELECT * INTO v_other_captured FROM public.payments WHERE order_id=p_order_id AND status::text='captured'
      AND provider_payment_id IS DISTINCT FROM p_provider_payment_id ORDER BY verified_at NULLS LAST,created_at LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      UPDATE public.payments SET status='captured',provider_payment_id=p_provider_payment_id,
        provider_signature=COALESCE(p_provider_signature,provider_signature),verified_at=COALESCE(verified_at,now()),updated_at=now()
       WHERE id=v_payment.id;
      RETURN jsonb_build_object('success',true,'refund_required',true,'duplicate_capture',true,
        'order_status',v_order.order_status::text,'inventory_confirmed',false);
    END IF;
  END IF;
  UPDATE public.payments SET status='captured',provider_payment_id=p_provider_payment_id,
    provider_signature=COALESCE(p_provider_signature,provider_signature),verified_at=COALESCE(verified_at,now()),updated_at=now(),
    method=COALESCE(method,'Razorpay Online') WHERE id=v_payment.id;
  UPDATE public.orders SET payment_status='captured',updated_at=now() WHERE id=p_order_id;

  IF v_order.order_status::text IN ('cancelled','abandoned') OR EXISTS (
    SELECT 1 FROM public.inventory_movements WHERE reference_id=p_order_id AND reference_type='order' AND movement_type='release'
  ) THEN
    UPDATE public.orders SET refund_status='pending' WHERE id=p_order_id AND refund_status<>'completed';
    RETURN jsonb_build_object('success',true,'refund_required',true,
      'order_status',v_order.order_status::text,'inventory_confirmed',false);
  END IF;
  UPDATE public.orders SET order_status='confirmed',updated_at=now()
    WHERE id=p_order_id AND order_status::text IN ('pending','pending_payment');
  v_inventory_result := public.confirm_inventory_sale_for_order(p_order_id);
  IF COALESCE((v_inventory_result->>'success')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Inventory confirmation failed during payment reconciliation' USING ERRCODE='P0001',DETAIL=COALESCE(v_inventory_result::text,'{}');
  END IF;
  RETURN jsonb_build_object('success',true,'refund_required',false,'order_status','confirmed','inventory_confirmed',true);
END;
$$;
REVOKE ALL ON FUNCTION public.reconcile_captured_payment_for_order(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_captured_payment_for_order(uuid,text,text,text) TO service_role;

-- Replace the existing expiry worker. It locks candidates safely, delegates release
-- to the established inventory RPC, and never releases a captured/payment-complete sale.
CREATE OR REPLACE FUNCTION public.reconcile_expired_reservations()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_order record;
  v_release jsonb;
  v_count integer := 0;
  v_released integer;
BEGIN
  FOR v_order IN
    SELECT o.id, o.payment_status::text AS payment_status, o.order_status::text AS order_status
      FROM public.orders o
     WHERE o.reservation_expires_at IS NOT NULL AND o.reservation_expires_at <= now()
       AND o.order_status::text IN ('pending', 'pending_payment')
       AND o.payment_status::text IN ('pending', 'failed', 'authorized')
       AND NOT EXISTS (SELECT 1 FROM public.inventory_movements m WHERE m.reference_id=o.id AND m.reference_type='order' AND m.movement_type='sale')
     ORDER BY o.reservation_expires_at, o.id
     FOR UPDATE OF o SKIP LOCKED
  LOOP
    BEGIN
      v_release := public.release_inventory_for_order(v_order.id, 'Online checkout reservation expired');
      IF COALESCE((v_release->>'success')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'Inventory release failed: %', COALESCE(v_release::text, '{}');
      END IF;
      v_released := COALESCE((v_release->>'released_items_count')::integer, 0);
      UPDATE public.orders SET order_status='abandoned'::public.order_status,
        cancelled_at=COALESCE(cancelled_at,now()), cancellation_reason='Online payment reservation expired', updated_at=now()
       WHERE id=v_order.id;
      INSERT INTO public.checkout_reconciliation_audit(order_id,event_type,previous_payment_status,previous_order_status,released_items_count)
      VALUES (v_order.id,'reservation_expired',v_order.payment_status,v_order.order_status,v_released);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[checkout-expiry] order % reconciliation failed: %', v_order.id, SQLERRM;
    END;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'reconciled_count', v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.reconcile_expired_reservations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_expired_reservations() TO service_role;

-- Supabase production scheduling through pg_cron. The migration fails visibly when
-- pg_cron is unavailable instead of leaving a silently unscheduled reconciler.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
DO $$
DECLARE v_job_id bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    RAISE EXCEPTION 'pg_cron is required to schedule checkout reservation reconciliation';
  END IF;
  FOR v_job_id IN SELECT jobid FROM cron.job WHERE jobname='vkv-reconcile-expired-reservations' LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;
  PERFORM cron.schedule('vkv-reconcile-expired-reservations', '* * * * *',
    $job$SELECT public.reconcile_expired_reservations();$job$);
END $$;

-- Auditable one-time legacy backfill. This is intentionally operator-invoked after
-- reviewing the preview; there is no broad stock reset or deletion of payment history.
CREATE OR REPLACE FUNCTION public.reconcile_legacy_expired_reservations(p_confirm boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
  IF p_confirm IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'EXPLICIT_CONFIRMATION_REQUIRED');
  END IF;
  v_result := public.reconcile_expired_reservations();
  RETURN v_result || jsonb_build_object('mode','legacy_expired_reservation_reconciliation','executed_at',now());
END;
$$;
REVOKE ALL ON FUNCTION public.reconcile_legacy_expired_reservations(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_legacy_expired_reservations(boolean) TO service_role;

COMMIT;

-- Deployment preview (run before the one-time service-role call):
-- SELECT o.id,o.order_number,o.payment_status,o.order_status,o.reservation_expires_at
-- FROM public.orders o
-- WHERE o.reservation_expires_at <= now()
--   AND o.order_status::text IN ('pending','pending_payment')
--   AND o.payment_status::text IN ('pending','failed','authorized')
--   AND NOT EXISTS (SELECT 1 FROM public.inventory_movements m WHERE m.reference_id=o.id AND m.reference_type='order' AND m.movement_type='sale')
-- ORDER BY o.reservation_expires_at;
