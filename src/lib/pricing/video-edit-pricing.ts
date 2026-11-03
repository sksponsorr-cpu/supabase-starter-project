/**
 * Coût fournisseur (KIE) des étapes vidéo, en crédits KIE.
 * Uniquement les modèles dont le tarif est documenté (Grok image-to-video, MiniMax H3, Seedance 2.5, Wan 3.0, lip sync Volcengine).
 * Seedance 2 Fast ajouté ; Seedance 2 standard : tarif non documenté. Sinon : erreur, jamais d'estimation inventée.
 * Référence : 1 crédit KIE ≈ 0,005 $ au tarif public (8 crédits = 0,04 $).
 */

export type Resolution480 = "480p" | "720p" | "1080p";
export type ResolutionMiniMax = "768P" | "2K";

export class PricingUnknownError extends Error {}

/** Grok Imagine image-to-video : crédits par seconde de sortie. */
const GROK_I2V_PER_SECOND: Record<Resolution480, number> = { "480p": 2.4, "720p": 4.5, "1080p": 8 };

/** MiniMax H3 reference-to-video : crédits par seconde. */
const MINIMAX_H3_PER_SECOND: Record<ResolutionMiniMax, number> = { "768P": 8, "2K": 13 };
const MINIMAX_H3_FREE_IMAGES = 5;
const MINIMAX_H3_PER_EXTRA_IMAGE = 4;

/** Arrondi au centième de crédit, vers le haut : on ne sous-facture jamais le fournisseur. */
function ceilCredits(value: number): number {
  return Math.ceil(value * 100) / 100;
}

export function grokImageToVideoCredits(input: { seconds: number; resolution: Resolution480 }): number {
  if (!Number.isInteger(input.seconds) || input.seconds < 6 || input.seconds > 30) {
    throw new PricingUnknownError("Grok image-to-video : durée entre 6 et 30 secondes.");
  }
  return ceilCredits(GROK_I2V_PER_SECOND[input.resolution] * input.seconds);
}

/**
 * Total = tarif × (durée générée + durée des vidéos de référence) + images supplémentaires.
 * Les 5 premières images sont gratuites, l'audio aussi.
 */
export function minimaxH3ReferenceCredits(input: {
  outputSeconds: number;
  inputVideoSeconds: number;
  referenceImageCount: number;
  resolution: ResolutionMiniMax;
}): number {
  if (!Number.isInteger(input.outputSeconds) || input.outputSeconds < 4 || input.outputSeconds > 15) {
    throw new PricingUnknownError("MiniMax H3 : durée de sortie entre 4 et 15 secondes.");
  }
  if (input.inputVideoSeconds < 0 || input.inputVideoSeconds > 15) {
    throw new PricingUnknownError("MiniMax H3 : vidéos de référence limitées à 15 secondes au total.");
  }
  const extraImages = Math.max(0, input.referenceImageCount - MINIMAX_H3_FREE_IMAGES);
  const seconds = input.outputSeconds + Math.ceil(input.inputVideoSeconds);
  return ceilCredits(MINIMAX_H3_PER_SECOND[input.resolution] * seconds + extraImages * MINIMAX_H3_PER_EXTRA_IMAGE);
}

export type Resolution2_5 = "480P" | "720P" | "1080P";

/** Seedance 2.5 : crédits par seconde. « avec vidéo » = entrée + sortie facturées ; « sans vidéo » = sortie seule. */
const SEEDANCE_2_5_PER_SECOND: Record<Resolution2_5, { withVideo: number; withoutVideo: number }> = {
  "480P": { withVideo: 17, withoutVideo: 28 },
  "720P": { withVideo: 38, withoutVideo: 63 },
  "1080P": { withVideo: 95, withoutVideo: 158 },
};

/**
 * Seedance 2.5 : total = tarif × (durée vidéos source + durée générée) si une vidéo source est fournie,
 * sinon tarif × durée générée. Durée générée 1 à 30 s, vidéos source 30 s au total au maximum.
 */
export function seedance25Credits(input: {
  outputSeconds: number;
  inputVideoSeconds: number;
  resolution: Resolution2_5;
}): number {
  if (!Number.isInteger(input.outputSeconds) || input.outputSeconds < 1 || input.outputSeconds > 30) {
    throw new PricingUnknownError("Seedance 2.5 : durée de sortie entre 1 et 30 secondes.");
  }
  if (input.inputVideoSeconds < 0 || input.inputVideoSeconds > 30) {
    throw new PricingUnknownError("Seedance 2.5 : vidéos source limitées à 30 secondes au total.");
  }
  const rate = SEEDANCE_2_5_PER_SECOND[input.resolution];
  if (input.inputVideoSeconds > 0) {
    return ceilCredits(rate.withVideo * (input.outputSeconds + Math.ceil(input.inputVideoSeconds)));
  }
  return ceilCredits(rate.withoutVideo * input.outputSeconds);
}

export type ResolutionWan = "480P" | "720P" | "1080P";

/** Wan 3.0 : crédits par seconde. Facturation : (vidéo source + sortie) × tarif ; sans vidéo source : sortie × tarif. */
const WAN_30_PER_SECOND: Record<ResolutionWan, number> = { "480P": 8, "720P": 16, "1080P": 32 };

export function wan30Credits(input: { outputSeconds: number; inputVideoSeconds: number; resolution: ResolutionWan }): number {
  if (!Number.isInteger(input.outputSeconds) || input.outputSeconds < 2 || input.outputSeconds > 30) {
    throw new PricingUnknownError("Wan 3.0 : durée de sortie entre 2 et 30 secondes.");
  }
  if (input.inputVideoSeconds < 0 || input.inputVideoSeconds + input.outputSeconds > 30) {
    throw new PricingUnknownError("Wan 3.0 : vidéo source + sortie ne doivent pas dépasser 30 secondes.");
  }
  const seconds = input.outputSeconds + Math.ceil(input.inputVideoSeconds);
  return ceilCredits(WAN_30_PER_SECOND[input.resolution] * seconds);
}

/** Volcengine video-to-video lip sync (KIE) : 8 crédits par seconde de vidéo. Ne traduit pas l'audio : il faut fournir l'audio cible. */
export function volcengineLipSyncCredits(input: { videoSeconds: number }): number {
  if (!Number.isFinite(input.videoSeconds) || input.videoSeconds <= 0) {
    throw new PricingUnknownError("Lip sync : durée de vidéo invalide.");
  }
  return ceilCredits(8 * input.videoSeconds);
}

export type Resolution2Fast = "480p" | "720p";

/** Seedance 2 Fast (bytedance/seedance-2-fast) : crédits par seconde. */
const SEEDANCE_2_FAST_PER_SECOND: Record<Resolution2Fast, { withVideo: number; withoutVideo: number }> = {
  "480p": { withVideo: 6.8, withoutVideo: 11.7 },
  "720p": { withVideo: 15, withoutVideo: 24.8 },
};

/**
 * Seedance 2 Fast : sortie de 1 à 15 s, vidéos source 15 s au total au maximum.
 * Avec vidéo source : tarif × (source + sortie). Sans vidéo : tarif × sortie.
 */
export function seedance2FastCredits(input: {
  outputSeconds: number;
  inputVideoSeconds: number;
  resolution: Resolution2Fast;
}): number {
  if (!Number.isInteger(input.outputSeconds) || input.outputSeconds < 1 || input.outputSeconds > 15) {
    throw new PricingUnknownError("Seedance 2 Fast : durée de sortie entre 1 et 15 secondes.");
  }
  if (input.inputVideoSeconds < 0 || input.inputVideoSeconds > 15) {
    throw new PricingUnknownError("Seedance 2 Fast : vidéos source limitées à 15 secondes au total.");
  }
  const rate = SEEDANCE_2_FAST_PER_SECOND[input.resolution];
  if (input.inputVideoSeconds > 0) {
    return ceilCredits(rate.withVideo * (input.outputSeconds + Math.ceil(input.inputVideoSeconds)));
  }
  return ceilCredits(rate.withoutVideo * input.outputSeconds);
}

/** Modèles sans tarif documenté : ils restent bloqués tant que le tarif n'est pas renseigné. */
export function assertPriced(model: string): never {
  throw new PricingUnknownError(`Tarif non documenté pour « ${model} ». Ajouter le tarif avant de l'utiliser.`);
}
