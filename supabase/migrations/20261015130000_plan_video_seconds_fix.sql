-- Quotas quotidiens (secondes de vidéo par 24 h) alignés sur src/lib/plans.ts.
-- Avant : Sam Flash Light, Pro et Sur mesure tombaient dans ELSE 30 (30 s par jour).
CREATE OR REPLACE FUNCTION public.plan_video_seconds(_plan text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _plan
    WHEN 'free' THEN 30
    WHEN 'sam_flash_light' THEN 200
    WHEN 'sam_flash_pro' THEN 400
    WHEN 'sam_flash_pro_annuel' THEN 400
    WHEN 'sam_flash_custom' THEN 200
    WHEN 'super_grok_monthly' THEN 200
    WHEN 'super_grok_annuel' THEN 200
    WHEN 'super_grok_plus' THEN 400
    WHEN 'superhearly_monthly' THEN 1200
    WHEN 'super_grok' THEN 200
    WHEN 'superhearly' THEN 1200
    ELSE 30
  END;
$$;
