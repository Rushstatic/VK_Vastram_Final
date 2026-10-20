-- Managed fabric taxonomy and single product-level colour attributes.
-- Idempotent: existing catalogue values are backfilled where possible.
BEGIN;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS primary_colour_hex TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS secondary_colour_name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS secondary_colour_hex TEXT;

-- Prefer the current product metadata, then the first saved variant's values.
-- Colour is product-level after this migration; variants no longer drive saree colour.
UPDATE public.products AS p
SET
  color = COALESCE(
    NULLIF(BTRIM(p.color), ''),
    NULLIF(BTRIM(p.metadata->>'primaryColourName'), ''),
    NULLIF(BTRIM(p.metadata->>'primaryColorName'), ''),
    (SELECT NULLIF(BTRIM(pv.color), '') FROM public.product_variants AS pv WHERE pv.product_id = p.id ORDER BY pv.created_at ASC NULLS LAST, pv.id ASC LIMIT 1)
  ),
  primary_colour_hex = COALESCE(
    NULLIF(BTRIM(p.primary_colour_hex), ''),
    NULLIF(BTRIM(p.metadata->>'primaryColourHex'), ''),
    NULLIF(BTRIM(p.metadata->>'primary_colour_hex'), ''),
    (SELECT NULLIF(BTRIM(pv.attributes->>'colorHexPrimary'), '') FROM public.product_variants AS pv WHERE pv.product_id = p.id ORDER BY pv.created_at ASC NULLS LAST, pv.id ASC LIMIT 1)
  ),
  secondary_colour_name = COALESCE(
    NULLIF(BTRIM(p.secondary_colour_name), ''),
    NULLIF(BTRIM(p.metadata->>'secondaryColourName'), ''),
    NULLIF(BTRIM(p.metadata->>'secondary_colour_name'), '')
  ),
  secondary_colour_hex = COALESCE(
    NULLIF(BTRIM(p.secondary_colour_hex), ''),
    NULLIF(BTRIM(p.metadata->>'secondaryColourHex'), ''),
    NULLIF(BTRIM(p.metadata->>'secondary_colour_hex'), ''),
    (SELECT NULLIF(BTRIM(pv.attributes->>'colorHexSecondary'), '') FROM public.product_variants AS pv WHERE pv.product_id = p.id ORDER BY pv.created_at ASC NULLS LAST, pv.id ASC LIMIT 1)
  )
WHERE NULLIF(BTRIM(p.color), '') IS NULL
   OR NULLIF(BTRIM(p.primary_colour_hex), '') IS NULL
   OR NULLIF(BTRIM(p.secondary_colour_name), '') IS NULL
   OR NULLIF(BTRIM(p.secondary_colour_hex), '') IS NULL;

-- Keep public site-settings reads limited to storefront-safe values, adding the
-- managed fabric list that now feeds the product form and storefront filters.

COMMIT;
