/**
 * Grille de crédits pour Gemini Omni Flash 1.1 (via KIE).
 * Coût KIE en dollars par génération sans vidéo de référence (360p, 720p, 1080p).
 * 4K volontairement exclu.
 */
export const KIE_USD_PER_SEGMENT: Record<number, number> = {
  4: 0.315,
  6: 0.42,
  8: 0.525,
  10: 0.63,
};

/** Hypothèses de tarification (à ajuster ici uniquement). */
export const OMNI_PRICING = {
  fcfaPerUsd: 600,
  margin: 2,
  fcfaPerCredit: 45,
} as const;

export const OMNI_DURATIONS = [4, 6, 8, 10] as const;
export const OMNI_RESOLUTIONS = ["360p", "720p", "1080p"] as const;
export type OmniResolution = (typeof OMNI_RESOLUTIONS)[number];

/** Résolution 1080p réservée aux abonnés Pro. */
export function allowedResolutions(planId: string): OmniResolution[] {
  return planId === "pro" ? ["360p", "720p", "1080p"] : ["360p", "720p"];
}

/** Crédits débités pour un segment (arrondi au crédit supérieur). */
export function omniSegmentCredits(durationSec: number): number {
  const usd = KIE_USD_PER_SEGMENT[durationSec];
  if (usd === undefined) throw new Error("Durée non prise en charge : 4, 6, 8 ou 10 secondes.");
  return Math.ceil((usd * OMNI_PRICING.fcfaPerUsd * OMNI_PRICING.margin) / OMNI_PRICING.fcfaPerCredit);
}

/**
 * Règle d'arrêt : renvoie le nombre de segments réalisables avec le solde,
 * en s'arrêtant dès que le solde ne couvre plus le segment suivant.
 */
export function segmentsAffordable(balance: number, durationsSec: number[]): number {
  let remaining = balance;
  let count = 0;
  for (const d of durationsSec) {
    const cost = omniSegmentCredits(d);
    if (remaining < cost) break;
    remaining -= cost;
    count += 1;
  }
  return count;
}
