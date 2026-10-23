/**
 * Coût des vidéos créateur en crédits Sam Flash, calculé à partir du tarif KIE.
 * Tarifs KIE en crédits KIE (1 cr. KIE = 0,005 $). Conversion et marge : ai-pricing.ts.
 * Fichier sans secret : utilisable côté client comme côté serveur.
 */
import { kieCreditsToSamCredits } from "@/lib/ai-pricing";

export type PricedModel = "grok-imagine" | "seedance-2" | "seedance-2-5" | "veo-3-1";
export type PricedResolution = "480p" | "720p" | "1080p";
export type VeoTier = "lite" | "fast" | "quality";

/** Tarifs par seconde, sans vidéo source (documentation KIE, pages des modèles). */
const PER_SECOND_KIE: Record<"grok-imagine" | "seedance-2" | "seedance-2-5", Partial<Record<PricedResolution, number>>> = {
  "grok-imagine": { "480p": 2.4, "720p": 4.5, "1080p": 8 },
  "seedance-2": { "480p": 19, "720p": 41, "1080p": 102 },
  "seedance-2-5": { "480p": 28, "720p": 63, "1080p": 158 },
};

/** Veo 3.1 : prix fixe par vidéo, selon le niveau et la résolution. Indépendant de la durée. */
const VEO_PER_VIDEO_KIE: Record<VeoTier, Partial<Record<PricedResolution, number>>> = {
  lite: { "720p": 30, "1080p": 35 },
  fast: { "720p": 60, "1080p": 65 },
  quality: { "720p": 250, "1080p": 255 },
};

export function isPricedModel(model: string | null | undefined): model is PricedModel {
  return model === "grok-imagine" || model === "seedance-2" || model === "seedance-2-5" || model === "veo-3-1";
}

/** Coût KIE, en crédits KIE. Null si la combinaison n'est pas proposée. */
export function kieCostFor(
  model: PricedModel,
  resolution: PricedResolution,
  seconds: number,
  tier: VeoTier = "fast",
): number | null {
  if (model === "veo-3-1") {
    return VEO_PER_VIDEO_KIE[tier][resolution] ?? null;
  }
  const rate = PER_SECOND_KIE[model][resolution];
  return rate === undefined ? null : rate * Math.max(1, Math.round(seconds));
}

/** Coût affiché et débité, en crédits Sam Flash entiers (au moins 1). Null si la combinaison n'existe pas. */
/** Majoration appliquée aux modèles Seedance (coût réel plus élevé). Modifiable ici seulement. */
export const SEEDANCE_SURCHARGE: Partial<Record<PricedModel, number>> = {
  "seedance-2": 1.5,
  "seedance-2-5": 1.5,
};

export function samCreditsFor(
  model: PricedModel,
  resolution: PricedResolution,
  seconds: number,
  tier: VeoTier = "fast",
): number | null {
  const kie = kieCostFor(model, resolution, seconds, tier);
  if (kie === null) return null;
  const surcharge = SEEDANCE_SURCHARGE[model] ?? 1;
  // Grok : +1 crédit fixe par génération.
  const flat = model === "grok-imagine" ? 1 : 0;
  return Math.max(1, Math.ceil(kieCreditsToSamCredits(kie) * surcharge) + flat);
}

/** Supplément fixe ajouté à chaque génération Seedance (toutes durées, toutes résolutions). */
export const SEEDANCE_FLAT_EXTRA = 5;

/**
 * Coût d'une génération créateur, tel qu'affiché dans la barre de saisie et débité.
 * Ne pas utiliser pour les pages d'abonnement ni la page d'accueil (elles gardent samCreditsFor).
 */
export function generationCreditsFor(
  model: PricedModel,
  resolution: PricedResolution,
  seconds: number,
  tier: VeoTier = "fast",
): number | null {
  const base = samCreditsFor(model, resolution, seconds, tier);
  if (base === null) return null;
  return base + (model === "seedance-2" || model === "seedance-2-5" ? SEEDANCE_FLAT_EXTRA : 0);
}
