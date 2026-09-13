-- 1. has_role en SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 2. Politique support_replies renforcée
DROP POLICY IF EXISTS "Participants insert replies" ON public.support_replies;
CREATE POLICY "Participants insert replies"
ON public.support_replies
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    is_staff = false
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'support')
    OR public.has_role(auth.uid(), 'moderator')
  )
  AND EXISTS (
    SELECT 1 FROM public.support_messages m
    WHERE m.id = support_replies.message_id
      AND (
        m.user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'support')
        OR public.has_role(auth.uid(), 'moderator')
      )
  )
);

-- 3. Galerie communautaire
CREATE TABLE IF NOT EXISTS public.community_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id uuid REFERENCES public.generations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  media_type text NOT NULL DEFAULT 'image',
  media_url text,
  storage_path text,
  status text NOT NULL DEFAULT 'en_attente',
  rejection_reason text,
  moderated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_gallery_status_idx ON public.community_gallery(status, created_at DESC);
CREATE INDEX IF NOT EXISTS community_gallery_user_idx ON public.community_gallery(user_id);
GRANT SELECT ON public.community_gallery TO anon;
GRANT SELECT, UPDATE, DELETE ON public.community_gallery TO authenticated;
GRANT ALL ON public.community_gallery TO service_role;
ALTER TABLE public.community_gallery ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public peut voir les creations approuvees" ON public.community_gallery;
CREATE POLICY "Public peut voir les creations approuvees"
  ON public.community_gallery FOR SELECT TO anon, authenticated
  USING (status = 'approuve');
DROP POLICY IF EXISTS "Auteur voit ses creations" ON public.community_gallery;
CREATE POLICY "Auteur voit ses creations"
  ON public.community_gallery FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Equipe voit tout" ON public.community_gallery;
CREATE POLICY "Equipe voit tout"
  ON public.community_gallery FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
DROP POLICY IF EXISTS "Equipe modere" ON public.community_gallery;
CREATE POLICY "Equipe modere"
  ON public.community_gallery FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
DROP POLICY IF EXISTS "Equipe supprime" ON public.community_gallery;
CREATE POLICY "Equipe supprime"
  ON public.community_gallery FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
DROP TRIGGER IF EXISTS update_community_gallery_updated_at ON public.community_gallery;
CREATE TRIGGER update_community_gallery_updated_at
  BEFORE UPDATE ON public.community_gallery
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Compteurs d'usage images/vidéos + pause de 3 h
ALTER TABLE public.daily_usage
  ADD COLUMN IF NOT EXISTS images_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS videos_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_pause_until timestamptz;

CREATE OR REPLACE FUNCTION public.reserve_media_quota(_user_id uuid, _media_type text)
RETURNS TABLE(allowed boolean, reason text, retry_at timestamptz, images_used integer, videos_used integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text := public.current_tier(_user_id);
  v_today date := (now() AT TIME ZONE 'utc')::date;
  v_img integer;
  v_vid integer;
  v_pause timestamptz;
  v_tomorrow timestamptz := ((v_today + 1)::timestamp AT TIME ZONE 'utc');
BEGIN
  INSERT INTO public.daily_usage(user_id, usage_date, seconds_used, tier)
  VALUES (_user_id, v_today, 0, v_tier)
  ON CONFLICT (user_id, usage_date) DO UPDATE SET tier = v_tier;

  SELECT du.images_used, du.videos_used, du.video_pause_until
    INTO v_img, v_vid, v_pause
  FROM public.daily_usage du
  WHERE du.user_id = _user_id AND du.usage_date = v_today;

  IF v_tier <> 'free' THEN
    IF _media_type = 'image' THEN
      UPDATE public.daily_usage du SET images_used = du.images_used + 1
        WHERE du.user_id = _user_id AND du.usage_date = v_today;
    ELSE
      UPDATE public.daily_usage du SET videos_used = du.videos_used + 1
        WHERE du.user_id = _user_id AND du.usage_date = v_today;
    END IF;
    RETURN QUERY SELECT true, 'ok'::text, NULL::timestamptz, v_img, v_vid;
    RETURN;
  END IF;

  IF _media_type = 'image' THEN
    IF v_img >= 5 THEN
      RETURN QUERY SELECT false, 'image_daily'::text, v_tomorrow, v_img, v_vid;
      RETURN;
    END IF;
    UPDATE public.daily_usage du SET images_used = du.images_used + 1
      WHERE du.user_id = _user_id AND du.usage_date = v_today
      RETURNING du.images_used INTO v_img;
    RETURN QUERY SELECT true, 'ok'::text, NULL::timestamptz, v_img, v_vid;
    RETURN;
  END IF;

  IF v_vid >= 9 THEN
    RETURN QUERY SELECT false, 'video_daily'::text, v_tomorrow, v_img, v_vid;
    RETURN;
  END IF;

  IF v_pause IS NOT NULL AND v_pause > now() THEN
    RETURN QUERY SELECT false, 'video_pause'::text, v_pause, v_img, v_vid;
    RETURN;
  END IF;

  UPDATE public.daily_usage du SET videos_used = du.videos_used + 1
    WHERE du.user_id = _user_id AND du.usage_date = v_today
    RETURNING du.videos_used INTO v_vid;

  IF v_vid = 5 THEN
    UPDATE public.daily_usage du SET video_pause_until = now() + interval '3 hours'
      WHERE du.user_id = _user_id AND du.usage_date = v_today;
  END IF;

  RETURN QUERY SELECT true, 'ok'::text, NULL::timestamptz, v_img, v_vid;
END; $$;

CREATE OR REPLACE FUNCTION public.refund_media_quota(_user_id uuid, _media_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_today date := (now() AT TIME ZONE 'utc')::date;
BEGIN
  IF _media_type = 'image' THEN
    UPDATE public.daily_usage du SET images_used = GREATEST(0, du.images_used - 1)
      WHERE du.user_id = _user_id AND du.usage_date = v_today;
  ELSE
    UPDATE public.daily_usage du
      SET videos_used = GREATEST(0, du.videos_used - 1),
          video_pause_until = CASE WHEN du.videos_used - 1 < 5 THEN NULL ELSE du.video_pause_until END
      WHERE du.user_id = _user_id AND du.usage_date = v_today;
  END IF;
END; $$;

REVOKE EXECUTE ON FUNCTION public.reserve_media_quota(uuid, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.refund_media_quota(uuid, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.reserve_media_quota(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_media_quota(uuid, text) TO service_role;

-- 5. Réglages application (offre promotionnelle)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id text PRIMARY KEY,
  promo_enabled boolean NOT NULL DEFAULT false,
  promo_prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lecture publique des reglages" ON public.app_settings;
CREATE POLICY "Lecture publique des reglages"
  ON public.app_settings FOR SELECT TO anon, authenticated
  USING (true);
DROP POLICY IF EXISTS "Admins modifient les reglages" ON public.app_settings;
CREATE POLICY "Admins modifient les reglages"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT UPDATE ON public.app_settings TO authenticated;
DROP TRIGGER IF EXISTS update_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.app_settings(id, promo_enabled, promo_prices)
VALUES ('global', false, '{"base": 0, "plus": null, "heavy": null}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 6. Politiques storage supplémentaires
DROP POLICY IF EXISTS "Equipe lit tous les medias" ON storage.objects;
CREATE POLICY "Equipe lit tous les medias"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'generations'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
  );

-- 7. Colonne promo_claimed_at sur profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS promo_claimed_at timestamptz;

-- 8. Colonnes plan_type/is_active sur subscriptions + table user_quotas
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_type text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE public.subscriptions
SET plan_type = CASE WHEN tier = 'superhearly' THEN 'superhearly_monthly'
                     WHEN tier = 'super_grok' THEN 'super_grok_monthly'
                     ELSE plan_type END
WHERE plan_type IS NULL;

CREATE TABLE IF NOT EXISTS public.user_quotas (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_video_limit_seconds integer NOT NULL DEFAULT 30,
  daily_video_used_seconds integer NOT NULL DEFAULT 0,
  daily_video_remaining_seconds integer NOT NULL DEFAULT 30,
  quota_period_start timestamptz NOT NULL DEFAULT now(),
  quota_period_end timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_quotas TO authenticated;
GRANT ALL ON public.user_quotas TO service_role;
ALTER TABLE public.user_quotas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own quota" ON public.user_quotas;
CREATE POLICY "Users can view own quota" ON public.user_quotas
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_user_quotas_updated_at ON public.user_quotas;
CREATE TRIGGER update_user_quotas_updated_at BEFORE UPDATE ON public.user_quotas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.plan_video_seconds(_plan text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _plan
    WHEN 'super_grok_monthly' THEN 190
    WHEN 'superhearly_monthly' THEN 380
    WHEN 'super_grok_annuel' THEN 950
    WHEN 'super_grok_plus' THEN 1900
    WHEN 'super_grok' THEN 190
    WHEN 'superhearly' THEN 380
    ELSE 30
  END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_video_seconds(_user_id uuid, _seconds integer)
RETURNS TABLE(
  allowed boolean,
  reason text,
  plan_type text,
  limit_seconds integer,
  used_seconds integer,
  remaining_seconds integer,
  period_end timestamptz,
  expires_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_expired boolean := false;
  v_plan text := 'free';
  v_expires timestamptz;
  v_limit integer;
  v_used integer;
  v_pstart timestamptz;
  v_pend timestamptz;
BEGIN
  UPDATE public.subscriptions
     SET is_active = false, status = 'expired'
   WHERE user_id = _user_id AND status = 'active'
     AND ends_at IS NOT NULL AND ends_at <= now();
  v_expired := FOUND;

  SELECT COALESCE(s.plan_type, s.tier), s.ends_at
    INTO v_plan, v_expires
    FROM public.subscriptions s
   WHERE s.user_id = _user_id AND s.status = 'active' AND s.is_active
     AND (s.ends_at IS NULL OR s.ends_at > now())
   ORDER BY s.started_at DESC
   LIMIT 1;

  v_plan := COALESCE(v_plan, 'free');
  v_limit := public.plan_video_seconds(v_plan);

  INSERT INTO public.user_quotas(user_id, daily_video_limit_seconds, daily_video_used_seconds,
                                 daily_video_remaining_seconds, quota_period_start, quota_period_end)
  VALUES (_user_id, v_limit, 0, v_limit, now(), now() + interval '24 hours')
  ON CONFLICT (user_id) DO NOTHING;

  SELECT q.daily_video_used_seconds, q.quota_period_start, q.quota_period_end
    INTO v_used, v_pstart, v_pend
    FROM public.user_quotas q WHERE q.user_id = _user_id;

  IF now() > v_pend THEN
    v_used := 0;
    v_pstart := now();
    v_pend := now() + interval '24 hours';
  END IF;

  UPDATE public.user_quotas q
     SET daily_video_limit_seconds = v_limit,
         daily_video_used_seconds = v_used,
         daily_video_remaining_seconds = GREATEST(0, v_limit - v_used),
         quota_period_start = v_pstart,
         quota_period_end = v_pend
   WHERE q.user_id = _user_id;

  IF v_expired AND v_plan = 'free' THEN
    RETURN QUERY SELECT false, 'subscription_expired', v_plan, v_limit, v_used,
                        GREATEST(0, v_limit - v_used), v_pend, v_expires;
    RETURN;
  END IF;

  IF _seconds > 0 AND v_used + _seconds > v_limit THEN
    RETURN QUERY SELECT false, 'video_seconds', v_plan, v_limit, v_used,
                        GREATEST(0, v_limit - v_used), v_pend, v_expires;
    RETURN;
  END IF;

  IF _seconds > 0 THEN
    UPDATE public.user_quotas q
       SET daily_video_used_seconds = v_used + _seconds,
           daily_video_remaining_seconds = GREATEST(0, v_limit - (v_used + _seconds))
     WHERE q.user_id = _user_id;
    v_used := v_used + _seconds;
  END IF;

  RETURN QUERY SELECT true, 'ok', v_plan, v_limit, v_used,
                      GREATEST(0, v_limit - v_used), v_pend, v_expires;
END; $$;

CREATE OR REPLACE FUNCTION public.refund_video_seconds(_user_id uuid, _seconds integer)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.user_quotas
     SET daily_video_used_seconds = GREATEST(0, daily_video_used_seconds - _seconds),
         daily_video_remaining_seconds = LEAST(daily_video_limit_seconds,
             daily_video_limit_seconds - GREATEST(0, daily_video_used_seconds - _seconds))
   WHERE user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.tier_daily_seconds(_tier text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT public.plan_video_seconds(_tier);
$$;

REVOKE ALL ON FUNCTION public.reserve_video_seconds(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_video_seconds(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_video_seconds(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_video_seconds(uuid, integer) TO service_role;