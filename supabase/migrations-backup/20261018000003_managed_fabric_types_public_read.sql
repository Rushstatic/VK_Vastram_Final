-- Allow the storefront and public product form controls to read the managed fabric taxonomy.
-- This does not grant write access; writes remain protected by the existing admin RLS policy.
BEGIN;
DROP POLICY IF EXISTS "Public can view storefront settings" ON public.site_settings;
CREATE POLICY "Public can view storefront settings"
  ON public.site_settings FOR SELECT
  USING (key IN ('general', 'policies', 'saree_types', 'fabric_types'));
COMMIT;
