/**
 * Coût des générations en crédits (abonnés uniquement).
 * Modifie ces deux valeurs pour changer le prix d'une génération.
 */

/** Crédits consommés par une image. */
export const IMAGE_CREDIT_COST = 1;

/** Crédits consommés par seconde de vidéo. */
export const VIDEO_CREDITS_PER_SECOND = 1;

export function creditCostFor(mediaType: "image" | "video", seconds: number): number {
  if (mediaType === "image") return IMAGE_CREDIT_COST;
  return Math.max(1, Math.ceil(seconds * VIDEO_CREDITS_PER_SECOND));
}

/** Produits achetés en crédits (recharges et pass), et non en abonnement. */
export function isCreditProduct(productId: string | null | undefined): boolean {
  return !!productId && (productId.startsWith("pack_") || productId.startsWith("pass_"));
}
