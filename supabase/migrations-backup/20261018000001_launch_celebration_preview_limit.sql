-- VK VASTRAM launch celebration: five total uses across all authenticated admin sessions.
-- Up to four rehearsal previews are permitted; the fifth potential use is reserved
-- for the one-time official launch. The counter and official marker are updated atomically.
-- Safe to re-run before the launch setting has been created.

BEGIN;

CREATE OR REPLACE FUNCTION public.consume_launch_celebration_use(p_mode TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_value JSONB;
  v_used INTEGER;
  v_new_used INTEGER;
  v_official_exists BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only an authenticated administrator can use the launch celebration.'
      USING ERRCODE = '42501';
  END IF;

  IF p_mode IS NULL OR p_mode NOT IN ('preview', 'official') THEN
    RAISE EXCEPTION 'Unsupported launch celebration mode.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.site_settings (key, value, description, updated_at)
  VALUES (
    'launch_celebration_preview_usage',
    jsonb_build_object('count', 0, 'limit', 5),
    'Shared five-use counter for VK VASTRAM launch celebration, including rehearsal previews and official launch',
    NOW()
  )
  ON CONFLICT (key) DO NOTHING;

  -- Serialize all preview and official-launch attempts by locking the shared counter row.
  SELECT s.value
    INTO v_value
    FROM public.site_settings AS s
   WHERE s.key = 'launch_celebration_preview_usage'
   FOR UPDATE;

  v_used := CASE
    WHEN COALESCE(v_value->>'count', '') ~ '^[0-9]+$' THEN (v_value->>'count')::INTEGER
    ELSE 0
  END;

  SELECT EXISTS (
    SELECT 1 FROM public.site_settings WHERE key = 'launch_celebration'
  ) INTO v_official_exists;

  IF v_official_exists THEN
    RETURN jsonb_build_object(
      'allowed', FALSE, 'reason', 'official_already_completed',
      'used', LEAST(5, GREATEST(0, v_used)), 'limit', 5,
      'remaining', GREATEST(0, 5 - v_used)
    );
  END IF;

  -- Keep one use available for the actual launch: previews may consume uses 1–4 only.
  IF p_mode = 'preview' AND v_used >= 4 THEN
    RETURN jsonb_build_object(
      'allowed', FALSE, 'reason', 'preview_limit_reserved_for_official',
      'used', LEAST(5, GREATEST(0, v_used)), 'limit', 5,
      'remaining', GREATEST(0, 5 - v_used)
    );
  END IF;

  IF v_used >= 5 THEN
    RETURN jsonb_build_object(
      'allowed', FALSE, 'reason', 'total_limit_reached',
      'used', 5, 'limit', 5, 'remaining', 0
    );
  END IF;

  v_new_used := v_used + 1;
  UPDATE public.site_settings
     SET value = jsonb_build_object('count', v_new_used, 'limit', 5),
         updated_at = NOW()
   WHERE key = 'launch_celebration_preview_usage';

  IF p_mode = 'official' THEN
    INSERT INTO public.site_settings (key, value, description, updated_at)
    VALUES (
      'launch_celebration',
      jsonb_build_object(
        'completed', TRUE,
        'launched_at', NOW(),
        'launch_id', 'vk-launch-' || gen_random_uuid()::TEXT
      ),
      'One-time official VK VASTRAM launch celebration completion marker',
      NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', TRUE,
    'mode', p_mode,
    'used', v_new_used,
    'limit', 5,
    'remaining', GREATEST(0, 5 - v_new_used)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_launch_celebration_use(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_launch_celebration_use(TEXT) TO authenticated;

COMMIT;
