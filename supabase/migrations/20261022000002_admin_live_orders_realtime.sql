-- Lets the open admin page receive live order changes (new order / payment captured) so it can
-- play the chime. Safe to re-run. Admin reads are still limited by the existing RLS policies.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'supabase_realtime publication not found; enable Realtime for orders in the dashboard.';
END;
$$;
