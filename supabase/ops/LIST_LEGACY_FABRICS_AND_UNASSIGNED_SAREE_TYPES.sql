-- Review existing product taxonomy before enforcing the managed lists.
-- Run SELECTs only first. Map values with the store owner before any UPDATE.

-- 1) Distinct fabric values and affected-product counts.
SELECT COALESCE(NULLIF(BTRIM(p.fabric), ''), '(blank)') AS existing_fabric,
       COUNT(*) AS product_count,
       ARRAY_AGG(p.id ORDER BY p.created_at) AS product_ids
FROM public.products AS p
GROUP BY COALESCE(NULLIF(BTRIM(p.fabric), ''), '(blank)')
ORDER BY product_count DESC, existing_fabric;

-- 2) Sarees that do not have a managed-type value in metadata.sareeType.
SELECT p.id, p.name, p.sku, p.slug, p.fabric, p.weave,
       p.metadata->>'sareeType' AS current_saree_type,
       p.created_at
FROM public.products AS p
JOIN public.categories AS c ON c.id = p.category_id
WHERE LOWER(c.slug) = 'sarees'
  AND NULLIF(BTRIM(p.metadata->>'sareeType'), '') IS NULL
ORDER BY p.created_at DESC;

-- 3) Distinct values currently stored as old subCategory metadata. Treat these
-- as suggested mappings only; do not automatically promote arbitrary weave text.
SELECT COALESCE(NULLIF(BTRIM(p.metadata->>'subCategory'), ''), '(blank)') AS legacy_subcategory,
       COUNT(*) AS product_count
FROM public.products AS p
JOIN public.categories AS c ON c.id = p.category_id
WHERE LOWER(c.slug) = 'sarees'
GROUP BY COALESCE(NULLIF(BTRIM(p.metadata->>'subCategory'), ''), '(blank)')
ORDER BY product_count DESC, legacy_subcategory;
