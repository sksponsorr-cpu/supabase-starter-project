ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'developer';

CREATE TABLE IF NOT EXISTS public.developer_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  amount_eur numeric NOT NULL DEFAULT 0,
  rate numeric NOT NULL DEFAULT 0.20,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (developer_id, order_id)
);

GRANT SELECT ON public.developer_earnings TO authenticated;
GRANT ALL ON public.developer_earnings TO service_role;
ALTER TABLE public.developer_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developpeurs lisent leurs gains" ON public.developer_earnings
  FOR SELECT TO authenticated USING (developer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_eur numeric NOT NULL,
  method text NOT NULL DEFAULT 'mobile_money',
  mobile text,
  note text,
  status text NOT NULL DEFAULT 'en_attente',
  admin_note text,
  processed_at timestamptz,
  processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.payout_requests TO authenticated;
GRANT ALL ON public.payout_requests TO service_role;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developpeurs lisent leurs demandes" ON public.payout_requests
  FOR SELECT TO authenticated USING (developer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Developpeurs creent leurs demandes" ON public.payout_requests
  FOR INSERT TO authenticated WITH CHECK (developer_id = auth.uid());

CREATE TRIGGER update_payout_requests_updated_at BEFORE UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'swychr';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS provider_session_id text;
CREATE INDEX IF NOT EXISTS orders_provider_session_id_idx ON public.orders (provider_session_id);

ALTER TABLE public.product_prices REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'product_prices'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.product_prices';
  END IF;
END $$;