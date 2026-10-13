-- Allow a product variant to appear as separate cart lines for Fall & Pico on/off.
-- Preserve the uniqueness guarantee for each variant + option combination.
ALTER TABLE public.cart_items DROP CONSTRAINT IF EXISTS cart_items_cart_id_product_variant_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS cart_items_variant_fall_pico_unique
  ON public.cart_items (cart_id, product_variant_id, (COALESCE(metadata->>'includeFallPico', 'false')));

-- Store split GST component amounts in the order-item metadata at insertion time,
-- using the authoritative GST total already calculated by checkout.
CREATE OR REPLACE FUNCTION public.snapshot_order_item_gst_components()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tax NUMERIC(10,2);
  v_seller_gstin TEXT := '';
  v_seller_code TEXT := '27';
  v_state TEXT := '';
  v_state_code TEXT := '';
  v_state_map JSONB := '{"maharashtra":"27","mh":"27","gujarat":"24","karnataka":"29","goa":"30","madhya pradesh":"23","uttar pradesh":"09","delhi":"07","rajasthan":"08","telangana":"36","andhra pradesh":"37","tamil nadu":"33","kerala":"32","west bengal":"19","punjab":"03","haryana":"06","bihar":"10","odisha":"21","assam":"18","jharkhand":"20","chhattisgarh":"22","himachal pradesh":"02","uttarakhand":"05"}'::jsonb;
  v_cgst NUMERIC(10,2);
  v_sgst NUMERIC(10,2);
BEGIN
  v_tax := COALESCE(NULLIF(NEW.product_metadata_snapshot->>'gstAmountSnapshot','')::NUMERIC, 0);
  SELECT COALESCE(value->>'gstin','') INTO v_seller_gstin FROM public.site_settings WHERE key = 'general';
  IF v_seller_gstin ~ '^\d{2}' THEN v_seller_code := SUBSTRING(v_seller_gstin FROM 1 FOR 2); END IF;
  SELECT LOWER(TRIM(COALESCE(o.shipping_address_snapshot->>'state','')))
    INTO v_state FROM public.orders o WHERE o.id = NEW.order_id;
  v_state := REGEXP_REPLACE(SPLIT_PART(v_state, ',', 1), '^in[- ]', '');
  v_state := REGEXP_REPLACE(v_state, '\s+state$', '');
  v_state_code := CASE WHEN v_state ~ '^\d{2}$' THEN v_state ELSE COALESCE(v_state_map->>v_state, '') END;
  IF v_tax > 0 THEN
    IF v_state_code = v_seller_code THEN
      v_cgst := ROUND(v_tax / 2, 2);
      v_sgst := v_tax - v_cgst;
      NEW.product_metadata_snapshot := COALESCE(NEW.product_metadata_snapshot, '{}'::jsonb) || jsonb_build_object(
        'taxTypeSnapshot','CGST/SGST','cgstAmountSnapshot',v_cgst,'sgstAmountSnapshot',v_sgst,'igstAmountSnapshot',0
      );
    ELSIF v_state_code <> '' THEN
      NEW.product_metadata_snapshot := COALESCE(NEW.product_metadata_snapshot, '{}'::jsonb) || jsonb_build_object(
        'taxTypeSnapshot','IGST','cgstAmountSnapshot',0,'sgstAmountSnapshot',0,'igstAmountSnapshot',v_tax
      );
    ELSE
      -- Preserve total and explicitly mark unresolved destination rather than losing tax.
      NEW.product_metadata_snapshot := COALESCE(NEW.product_metadata_snapshot, '{}'::jsonb) || jsonb_build_object(
        'taxTypeSnapshot','GST_STATE_UNRESOLVED','cgstAmountSnapshot',0,'sgstAmountSnapshot',0,'igstAmountSnapshot',0
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS order_item_gst_component_snapshot ON public.order_items;
CREATE TRIGGER order_item_gst_component_snapshot
BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.snapshot_order_item_gst_components();
