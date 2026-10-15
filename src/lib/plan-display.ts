import { creditCostFor, type CreditConfig } from "@/lib/credits";

/**
 * Calculs affichés aux clients, toujours dérivés de la configuration de crédits.
 * Si vous modifiez les crédits dans le bureau d'administrateur, tout se met à jour.
 */

/** Crédits nécessaires à l'essai gratuit : 1 vidéo de 8 s en 480p + 2 images. Calculé, jamais écrit en dur. */
export function freeCredits(cfg: CreditConfig) {
  return creditCostFor("video", 8, "480p", cfg) + 2 * creditCostFor("image", 1, "480p", cfg);
}

/** Nombre de vidéos de N secondes (en 480p par défaut) que permet un nombre de crédits. */
export function videosFor(credits: number, seconds = 5, resolution: "480p" | "720p" = "480p", cfg: CreditConfig) {
  return Math.floor(credits / creditCostFor("video", seconds, resolution, cfg));
}

/** Nombre d'images que permet un nombre de crédits. */
export function imagesFor(credits: number, cfg: CreditConfig) {
  return Math.floor(credits / creditCostFor("image", 1, "480p", cfg));
}

/** Coût d'une vidéo de N secondes (en 480p). */
export function videoCost(seconds: number, cfg: CreditConfig, resolution: "480p" | "720p" = "480p") {
  return creditCostFor("video", seconds, resolution, cfg);
}

/** Coût d'une image. */
export function imageCost(cfg: CreditConfig) {
  return creditCostFor("image", 1, "480p", cfg);
}
