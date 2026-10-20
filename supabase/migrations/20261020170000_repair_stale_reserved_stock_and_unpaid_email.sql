-- Repair stale reserved_quantity counters left behind by abandoned legacy checkouts.
-- Keep the movement ledger authoritative and preserve only valid, unexpired reservations.
BEGIN;

-- Release any recorded legacy online reservation for unpaid attempts before rebuilding counters.
DO $$
DECLARE v_order RECORD;
BEGIN
  FOR v_order IN
    SELECT o.id
      FROM public.orders o
     WHERE o.checkout_payment_method = 'online'
       AND o.payment_status::TEXT IN ('pending','failed','authorized')
       AND o.order_status::TEXT IN ('pending','pending_payment','cancelled')
       AND EXISTS (
         SELECT 1 FROM public.inventory_movements im
          WHERE im.reference_type = 'order'
            AND im.reference_id = o.id
            AND im.movement_type = 'reservation'
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.inventory_movements im
          WHERE im.reference_type = 'order'
            AND im.reference_id = o.id
            AND im.movement_type IN ('sale','release')
       )
     FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.release_inventory_for_order(v_order.id,
      'Legacy abandoned online checkout released during reserved stock repair');
  END LOOP;
END $$;

-- Correct drift even where old code incremented reserved_quantity but failed to write
-- a reservation movement. Only reservations with a future expiry and no terminal
-- sale/release movement remain counted. New online checkouts never reserve stock.
-- The previous LEFT JOIN formulation must update variants with no active holds too.
UPDATE public.product_variants pv
   SET reserved_quantity = COALESCE((
     SELECT SUM(im.quantity)::INTEGER
       FROM public.inventory_movements im
       JOIN public.orders o ON o.id = im.reference_id AND im.reference_type = 'order'
      WHERE im.product_variant_id = pv.id
        AND im.movement_type = 'reservation'
        AND o.reservation_expires_at > NOW()
        AND o.payment_status::TEXT = 'pending'
        AND o.order_status::TEXT IN ('pending','pending_payment')
        AND NOT EXISTS (
          SELECT 1 FROM public.inventory_movements terminal
           WHERE terminal.reference_type = 'order'
             AND terminal.reference_id = o.id
             AND terminal.movement_type IN ('sale','release')
        )
   ), 0),
       updated_at = NOW()
 WHERE reserved_quantity <> COALESCE((
     SELECT SUM(im.quantity)::INTEGER
       FROM public.inventory_movements im
       JOIN public.orders o ON o.id = im.reference_id AND im.reference_type = 'order'
      WHERE im.product_variant_id = pv.id
        AND im.movement_type = 'reservation'
        AND o.reservation_expires_at > NOW()
        AND o.payment_status::TEXT = 'pending'
        AND o.order_status::TEXT IN ('pending','pending_payment')
        AND NOT EXISTS (
          SELECT 1 FROM public.inventory_movements terminal
           WHERE terminal.reference_type = 'order'
             AND terminal.reference_id = o.id
             AND terminal.movement_type IN ('sale','release')
        )
   ), 0);

COMMIT;
