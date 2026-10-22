-- Demandes d'adhésion au programme partenaires, validées par l'admin.
CREATE TABLE IF NOT EXISTS public.partner_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  country_code text NOT NULL,
  channels text NOT NULL,
  audience text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'approuve', 'refuse')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.partner_applications TO authenticated;
GRANT ALL ON public.partner_applications TO service_role;

CREATE POLICY "Applicants view own application" ON public.partner_applications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all applications" ON public.partner_applications
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
