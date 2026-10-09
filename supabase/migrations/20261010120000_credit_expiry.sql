-- Étape 2 : crédits avec date d'expiration (10 jours) et compatibilité avec le solde existant.
-- Principe : profiles.credits_balance reste la référence du solde affiché.
-- credit_grants indique quand les crédits achetés expirent.

-- 1. Lots de crédits
CREATE TABLE IF NOT EXISTS public.credit_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount > 0),
  remaining integer NOT NULL CHECK (remaining >= 0),
  expires_at timestamptz NOT NULL,
  kind text NOT NULL,
  ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_grants_user_expiry_idx
  ON public.credit_grants (user_id, expires_at)
  WHERE remaining > 0;

ALTER TABLE public.credit_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Utilisateur voit ses lots de crédits" ON public.credit_grants;
CREATE POLICY "Utilisateur voit ses lots de crédits" ON public.credit_grants
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.credit_grants TO authenticated;
GRANT ALL ON public.credit_grants TO service_role;

-- 2. Reprise du solde existant : les anciens crédits ne expirent pas
INSERT INTO public.credit_grants (user_id, amount, remaining, expires_at, kind, ref)
SELECT p.id, p.credits_balance, p.credits_balance, '2100-01-01T00:00:00Z', 'legacy', 'migration-2026-10'
FROM public.profiles p
WHERE p.credits_balance > 0
  AND NOT EXISTS (SELECT 1 FROM public.credit_grants g WHERE g.user_id = p.id);

-- 3. Ajout de crédits : crée un lot qui expire dans 10 jours
CREATE OR REPLACE FUNCTION public.add_credits(p_user uuid, p_amount integer, p_kind text, p_ref text DEFAULT NULL::text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_balance integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montant de crédits invalide';
  END IF;

  UPDATE public.profiles
     SET credits_balance = credits_balance + p_amount
   WHERE id = p_user
   RETURNING credits_balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'Profil introuvable pour cet utilisateur';
  END IF;

  INSERT INTO public.credit_grants (user_id, amount, remaining, expires_at, kind, ref)
  VALUES (p_user, p_amount, p_amount, now() + interval '10 days', p_kind, p_ref);

  INSERT INTO public.credit_ledger (user_id, delta, balance_after, kind, ref)
  VALUES (p_user, p_amount, new_balance, p_kind, p_ref);

  RETURN new_balance;
END;
$function$;

-- 4. Dépense : consomme d'abord les lots qui expirent le plus tôt
CREATE OR REPLACE FUNCTION public.spend_credits(p_user uuid, p_amount integer, p_ref text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_balance integer;
  need integer := p_amount;
  g record;
  take integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN true;
  END IF;

  SELECT credits_balance INTO current_balance
    FROM public.profiles
   WHERE id = p_user
     FOR UPDATE;

  IF current_balance IS NULL OR current_balance < p_amount THEN
    RETURN false;
  END IF;

  FOR g IN
    SELECT id, remaining
      FROM public.credit_grants
     WHERE user_id = p_user
       AND remaining > 0
       AND expires_at > now()
     ORDER BY expires_at, created_at
       FOR UPDATE
  LOOP
    EXIT WHEN need <= 0;
    take := LEAST(g.remaining, need);
    UPDATE public.credit_grants SET remaining = remaining - take WHERE id = g.id;
    need := need - take;
  END LOOP;

  UPDATE public.profiles
     SET credits_balance = credits_balance - p_amount
   WHERE id = p_user;

  RETURN true;
END;
$function$;

-- 5. Expiration : retire du solde les crédits dont le lot a expiré
CREATE OR REPLACE FUNCTION public.expire_credits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec record;
  total integer := 0;
BEGIN
  FOR rec IN
    SELECT user_id, SUM(remaining)::integer AS expired
      FROM public.credit_grants
     WHERE remaining > 0
       AND expires_at <= now()
     GROUP BY user_id
  LOOP
    UPDATE public.credit_grants
       SET remaining = 0
     WHERE user_id = rec.user_id
       AND remaining > 0
       AND expires_at <= now();

    UPDATE public.profiles
       SET credits_balance = GREATEST(0, credits_balance - rec.expired)
     WHERE id = rec.user_id;

    total := total + rec.expired;
  END LOOP;

  RETURN total;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.expire_credits() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.expire_credits() TO service_role;

-- 6. Exécution automatique toutes les heures (si pg_cron est activé dans Supabase)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('expire-credits', '0 * * * *', 'SELECT public.expire_credits();');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron non configuré : lancer expire_credits() manuellement ou activer pg_cron.';
END;
$$;
