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