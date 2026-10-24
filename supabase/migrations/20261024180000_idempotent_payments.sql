-- ============================================================================
-- MIGRATION : Idempotence et atomicité des paiements (Règles 1 à 7)
-- ============================================================================

-- 1. Sécuriser add_credits : vérifie si un octroi avec ce même 'ref' existe déjà
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

  -- Règle 5 : Verrou anti-doublon dans la base
  -- Si p_ref est renseigné et qu'un crédit a déjà été accordé avec cette référence pour cet utilisateur,
  -- on retourne directement le solde actuel sans rien ajouter en double.
  IF p_ref IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.credit_grants WHERE user_id = p_user AND ref = p_ref
  ) THEN
    SELECT credits_balance INTO new_balance FROM public.profiles WHERE id = p_user;
    RETURN COALESCE(new_balance, 0);
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

-- 2. Index unique partiel pour garantir au niveau physique l'unicité par commande
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_grants_order_ref
  ON public.credit_grants(ref)
  WHERE ref IS NOT NULL AND ref NOT IN ('migration-2026-10', 'appareil', 'echec-generation');
