/**
 * Tarification des outils IA.
 * - 1 crédit Kie = 0,005 $
 * - Prix facturé = coût Kie × 1,60
 * - 1 $ = 0,92 € (taux fixe à confirmer)
 * - 100 crédits Sam Flash = 9 €, donc 1 crédit Sam Flash = 0,09 €
 */
export const KIE_USD_PER_CREDIT = 0.005;
export const MARKUP = 1.6;
export const EUR_PER_USD = 0.92;
export const EUR_PER_SAM_CREDIT = 0.09;

/** Convertit le coût Kie (en crédits Kie) en crédits Sam Flash, sans arrondi. */
export function kieCreditsToSamCredits(kieCredits: number): number {
  const usd = kieCredits * KIE_USD_PER_CREDIT;
  const eur = usd * MARKUP * EUR_PER_USD;
  return eur / EUR_PER_SAM_CREDIT;
}
