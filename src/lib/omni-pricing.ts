/**
 * Tarification des segments Omni (Gemini Omni Flash 1.1 via KIE).
 * Les crédits sont fixes par durée : 4 s = 12, 6 s = 18, 8 s = 22, 10 s = 27.
 * Pour changer un prix, modifiez uniquement la table ci-dessous.
 */
export const OMNI_SEGMENT_CREDITS: Record<number, number> = {
  4: 12,
  6: 18,
  8: 22,
  10: 27,
};

export const OMNI_DURATIONS = [4, 6, 8, 10] as const;
export const OMNI_RESOLUTIONS = ["360p", "720p"] as const;
export type OmniResolution = (typeof OMNI_RESOLUTIONS)[number];

/** Crédits débités pour un segment de la durée donnée. */
export function omniSegmentCredits(durationSec: number): number {
  const credits = OMNI_SEGMENT_CREDITS[durationSec];
  if (credits === undefined) throw new Error("Durée non prise en charge : 4, 6, 8 ou 10 secondes.");
  return credits;
}

/**
 * Règle d'arrêt : nombre de segments que le solde permet de payer, dans l'ordre.
 * S'arrête dès que le solde ne couvre plus le segment suivant.
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
