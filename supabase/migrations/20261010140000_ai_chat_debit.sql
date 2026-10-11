-- Débit précis des crédits pour les outils IA (Claude, ChatGPT).
-- Les fractions de crédit sont conservées : on ne facture jamais un crédit entier par message.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credits_fraction numeric NOT NULL DEFAULT 0
  CHECK (credits_fraction >= 0 AND credits_fraction < 1);

CREATE OR REPLACE FUNCTION public.debit_ai_credits(p_user uuid, p_cost numeric, p_ref text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  frac numeric;
  total numeric;
  whole integer;
  newfrac numeric;
BEGIN
  IF p_cost IS NULL OR p_cost < 0 THEN
    RETURN false;
  END IF;

  SELECT credits_fraction INTO frac
    FROM public.profiles
   WHERE id = p_user
     FOR UPDATE;

  IF frac IS NULL THEN
    RETURN false;
  END IF;

  total := frac + p_cost;
  whole := floor(total);
  newfrac := total - whole;

  IF whole > 0 THEN
    IF NOT public.spend_credits(p_user, whole, p_ref) THEN
      RETURN false;
    END IF;
  END IF;

  UPDATE public.profiles
     SET credits_fraction = newfrac
   WHERE id = p_user;

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.debit_ai_credits(uuid, numeric, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.debit_ai_credits(uuid, numeric, text) TO service_role;
