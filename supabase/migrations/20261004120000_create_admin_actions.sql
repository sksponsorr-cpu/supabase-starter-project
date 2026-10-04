-- Migration: Création du journal des actions d'administration (admin_actions)
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index pour accélérer les recherches par utilisateur cible ou par administrateur
CREATE INDEX IF NOT EXISTS admin_actions_target_user_idx ON public.admin_actions(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_actions_admin_idx ON public.admin_actions(admin_id, created_at DESC);

-- Activation de Row Level Security (RLS)
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

-- Lecture réservée aux administrateurs
CREATE POLICY "Admins can view admin actions"
  ON public.admin_actions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Aucune politique d'écriture (INSERT / UPDATE / DELETE) pour le client web / authenticated / anon.
-- Les écritures sont effectuées exclusivement côté serveur via le service role (supabaseAdmin).
GRANT SELECT ON public.admin_actions TO authenticated;
GRANT ALL ON public.admin_actions TO service_role;
