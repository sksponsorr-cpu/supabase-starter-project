-- Mise à jour des quotas journaliers de secondes vidéo par formule d'abonnement.
-- - Super Grok (mensuel & annuel) : 200 s/jour
-- - Super Grok Plus : 400 s/jour
-- - Superhearly (Super Grok Heavy) : 1200 s/jour
-- - Découverte (free) : 30 s/jour

CREATE OR REPLACE FUNCTION public.plan_video_seconds(_plan text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _plan
    WHEN 'super_grok_monthly' THEN 200
    WHEN 'super_grok_annuel' THEN 200
    WHEN 'super_grok_plus' THEN 400
    WHEN 'superhearly_monthly' THEN 1200
    WHEN 'super_grok' THEN 200
    WHEN 'superhearly' THEN 1200
    ELSE 30
  END;
$$;

CREATE OR REPLACE FUNCTION public.tier_daily_seconds(_tier text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT public.plan_video_seconds(_tier);
$$;
