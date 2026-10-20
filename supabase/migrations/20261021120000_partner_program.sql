-- Programme partenaires : pays du partenaire, commissions par achat, retraits à solde séparé.

ALTER TABLE public.referral_codes ADD COLUMN IF NOT EXISTS country_code text;

CREATE TABLE IF NOT EXISTS public.partner_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_eur numeric NOT NULL,
  country_code text NOT NULL,
  currency text NOT NULL,
  amount_local numeric NOT NULL,
  method text NOT NULL,
  mobile text NOT NULL,
  status text NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'verse', 'refuse')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.partner_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid UNIQUE REFERENCES public.orders(id) ON DELETE SET NULL,
  order_amount_eur numeric NOT NULL,
  commission_eur numeric NOT NULL,
  status text NOT NULL DEFAULT 'disponible' CHECK (status IN ('disponible', 'reserve', 'verse')),
  withdrawal_id uuid REFERENCES public.partner_withdrawals(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_commissions_referrer_idx ON public.partner_commissions(referrer_id, status);
CREATE INDEX IF NOT EXISTS partner_withdrawals_user_idx ON public.partner_withdrawals(user_id, status);

ALTER TABLE public.partner_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_commissions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.partner_withdrawals TO authenticated;
GRANT SELECT ON public.partner_commissions TO authenticated;
GRANT ALL ON public.partner_withdrawals TO service_role;
GRANT ALL ON public.partner_commissions TO service_role;

CREATE POLICY "Partners view own withdrawals" ON public.partner_withdrawals
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all partner withdrawals" ON public.partner_withdrawals
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Partners view own commissions" ON public.partner_commissions
  FOR SELECT TO authenticated USING (auth.uid() = referrer_id);
CREATE POLICY "Admins view all partner commissions" ON public.partner_commissions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
