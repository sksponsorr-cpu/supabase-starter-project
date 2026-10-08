/**
 * Coût des générations en crédits (abonnés uniquement).
 * Les valeurs de base correspondent à la qualité 480p.
 * La qualité supérieure multiplie le coût.
 */

/** Crédits pour une image en 480p. */
export const IMAGE_CREDIT_COST = 1;

/** Crédits par seconde de vidéo en 480p. */
export const VIDEO_CREDITS_PER_SECOND = 1;

/** Multiplicateur selon la qualité. */
export const RESOLUTION_MULTIPLIER: Record<string, number> = {
  "480p": 1,
  "720p": 2,
  "1080p": 3,
};

export function creditCostFor(
  mediaType: "image" | "video",
  seconds: number,
  resolution: string = "720p",
): number {
  const mult = RESOLUTION_MULTIPLIER[resolution] ?? 2;
  if (mediaType === "image") return Math.max(1, Math.round(IMAGE_CREDIT_COST * mult));
  return Math.max(1, Math.ceil(seconds * VIDEO_CREDITS_PER_SECOND * mult));
}

/** Produits achetés en crédits (recharges et pass), et non en abonnement. */
export function isCreditProduct(productId: string | null | undefined): boolean {
  return !!productId && (productId.startsWith("pack_") || productId.startsWith("pass_"));
}

/**
 * Fin de l'offre de lancement (heure de Paris).
 * Modifie cette date pour changer le compteur affiché sur les abonnements.
 */
export const OFFER_END_ISO = "2026-10-15T23:59:59+02:00";
