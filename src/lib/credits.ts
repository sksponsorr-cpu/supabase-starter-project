/**
 * Coût des générations en crédits. Fichier partagé client + serveur (sans accès base).
 * Les valeurs par défaut ci-dessous sont utilisées tant que l'administrateur
 * n'a pas enregistré d'autres valeurs (voir credits.server.ts).
 */

export type MediaType = "image" | "video" | "clone_video";
export type Resolution = "480p" | "720p" | "1080p";

export type CreditConfig = {
  /** Crédits par seconde de vidéo générée, par résolution. */
  videoPerSecond: Record<Resolution, number>;
  /** Crédits par seconde de vidéo de référence pour le clonage vidéo. */
  cloneVideoPerSecond: number;
  /** Crédits par image. */
  imageCost: number;
  /** Taux des frais affichés au client (ex. 0.105). */
  feeRate: number;
};

/** Valeurs de départ, validées avec la propriétaire du site. */
export const DEFAULT_CREDIT_CONFIG: CreditConfig = {
  videoPerSecond: { "480p": 50, "720p": 69, "1080p": 84 }, // 1080p : valeur provisoire, à confirmer
  cloneVideoPerSecond: 101,
  imageCost: 1,
  feeRate: 0.105,
};

/** Fusionne une configuration partielle (venant de la base) avec les valeurs par défaut. */
export function mergeCreditConfig(partial: Partial<CreditConfig> | null | undefined): CreditConfig {
  if (!partial) return DEFAULT_CREDIT_CONFIG;
  return {
    videoPerSecond: { ...DEFAULT_CREDIT_CONFIG.videoPerSecond, ...(partial.videoPerSecond ?? {}) },
    cloneVideoPerSecond: partial.cloneVideoPerSecond ?? DEFAULT_CREDIT_CONFIG.cloneVideoPerSecond,
    imageCost: partial.imageCost ?? DEFAULT_CREDIT_CONFIG.imageCost,
    feeRate: partial.feeRate ?? DEFAULT_CREDIT_CONFIG.feeRate,
  };
}

/**
 * Nombre de crédits retirés pour une génération.
 * Compatible avec l'ancienne signature : creditCostFor(mediaType, seconds, resolution).
 */
export function creditCostFor(
  mediaType: MediaType,
  seconds: number,
  resolution: Resolution | string = "720p",
  config: CreditConfig = DEFAULT_CREDIT_CONFIG,
): number {
  if (mediaType === "image") return Math.max(1, Math.round(config.imageCost));
  if (mediaType === "clone_video") {
    return Math.max(1, Math.ceil(seconds * config.cloneVideoPerSecond));
  }
  const table = config.videoPerSecond as Record<string, number>;
  const rate = table[resolution] ?? config.videoPerSecond["720p"];
  return Math.max(1, Math.ceil(seconds * rate));
}

/** Prix affiché au client : le nombre de crédits est la seule valeur visible. Les frais s'ajoutent au prix du pack. */
export function priceWithFees(priceFcfa: number, config: CreditConfig = DEFAULT_CREDIT_CONFIG): number {
  return Math.round(priceFcfa * (1 + config.feeRate));
}

/** Nombre de vidéos de N secondes qu'un solde permet d'obtenir. */
export function videosAvailable(
  balance: number,
  seconds: number,
  resolution: Resolution | string = "480p",
  config: CreditConfig = DEFAULT_CREDIT_CONFIG,
): number {
  return Math.floor(balance / creditCostFor("video", seconds, resolution, config));
}
