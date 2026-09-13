CREATE TABLE IF NOT EXISTS public.device_fingerprints (
  fingerprint text PRIMARY KEY,
  first_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  free_used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.device_fingerprints TO authenticated;
GRANT ALL ON public.device_fingerprints TO service_role;
ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own device" ON public.device_fingerprints FOR SELECT TO authenticated USING (first_user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.user_devices (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, fingerprint)
);
GRANT SELECT ON public.user_devices TO authenticated;
GRANT ALL ON public.user_devices TO service_role;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own devices" ON public.user_devices FOR SELECT TO authenticated USING (user_id = auth.uid());