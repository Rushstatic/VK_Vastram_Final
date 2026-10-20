-- Publish only the minimum archive-state information needed by the storefront.
-- Full collection rows remain protected by the existing active/admin RLS policy.
BEGIN;

CREATE OR REPLACE FUNCTION public.storefront_collection_visibility()
RETURNS TABLE (slug TEXT, is_active BOOLEAN, sort_order INT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT c.slug, c.is_active, c.sort_order
  FROM public.collections AS c
  ORDER BY c.sort_order ASC, c.slug ASC;
$$;

REVOKE ALL ON FUNCTION public.storefront_collection_visibility() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storefront_collection_visibility() TO anon, authenticated, service_role;
ALTER FUNCTION public.storefront_collection_visibility()
  SET search_path = pg_catalog, public, pg_temp;

COMMIT;
