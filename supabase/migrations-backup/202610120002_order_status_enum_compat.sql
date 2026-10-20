-- Reconcile deployed enum values with the manual fulfillment workflow.
-- Keep this migration limited to enum additions; Postgres requires newly added
-- enum values to be committed before other objects start using them.
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'packed';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'out_for_delivery';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'return_requested';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'refunded';

ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'cod_pending';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'cod_collected';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'cod_settled';
