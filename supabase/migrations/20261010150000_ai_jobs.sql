-- Outils IA asynchrones : Clonage vidéo et Avatar AI.

CREATE TABLE IF NOT EXISTS public.ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool text NOT NULL,
  variant text NOT NULL,
  kie_task_id text,
  status text NOT NULL DEFAULT 'pending',
  seconds numeric NOT NULL,
  cost_charged numeric NOT NULL,
  result_url text,
  error text,
  refunded boolean NOT NULL DEFAULT false,
  reconciled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_jobs_user_created_idx ON public.ai_jobs (user_id, created_at DESC);

ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Utilisateur voit ses générations" ON public.ai_jobs;
CREATE POLICY "Utilisateur voit ses générations" ON public.ai_jobs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.ai_jobs TO authenticated;
GRANT ALL ON public.ai_jobs TO service_role;

-- Remboursement précis (avec décimales) d'une génération échouée ou surfacturée.
CREATE OR REPLACE FUNCTION public.refund_ai_credits(p_user uuid, p_cost numeric, p_ref text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  frac numeric;
  total numeric;
  whole integer;
BEGIN
  IF p_cost IS NULL OR p_cost <= 0 THEN
    RETURN true;
  END IF;

  SELECT credits_fraction INTO frac
    FROM public.profiles
   WHERE id = p_user
     FOR UPDATE;

  IF frac IS NULL THEN
    RETURN false;
  END IF;

  total := frac - p_cost;

  IF total >= 0 THEN
    UPDATE public.profiles SET credits_fraction = total WHERE id = p_user;
  ELSE
    whole := ceil(-total);
    PERFORM public.add_credits(p_user, whole, 'refund', p_ref);
    UPDATE public.profiles SET credits_fraction = total + whole WHERE id = p_user;
  END IF;

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.refund_ai_credits(uuid, numeric, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.refund_ai_credits(uuid, numeric, text) TO service_role;
