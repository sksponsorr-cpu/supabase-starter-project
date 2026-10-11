-- Prix saisis en FCFA. Le site les convertit automatiquement dans la devise du client.
-- amount_eur reste en place (historique des commandes) ; il sera recalculé à partir des FCFA.

ALTER TABLE public.product_prices
  ADD COLUMN IF NOT EXISTS amount_fcfa numeric(12,0),
  ADD COLUMN IF NOT EXISTS amount_fcfa_yearly numeric(12,0);

-- Sam Flash Light (ancienne offre "base") : 5 000 FCFA par mois, 110 crédits
UPDATE public.product_prices
SET amount_fcfa = 5000
WHERE id = 'base';

-- Sam Flash Pro (ancienne offre "plus") : 16 500 FCFA par mois, 165 000 FCFA par an
UPDATE public.product_prices
SET amount_fcfa = 16500, amount_fcfa_yearly = 165000
WHERE id = 'plus';

-- Heavy est retiré
UPDATE public.product_prices
SET active = false
WHERE id = 'heavy';

-- Vérification
SELECT id, label, amount_fcfa, amount_fcfa_yearly, active
FROM public.product_prices
ORDER BY sort_order;
