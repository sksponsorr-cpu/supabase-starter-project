import type { ModelId } from "@/lib/creator-models";

/**
 * Durée maximale qu'un modèle sait générer (limite technique).
 */
export const MODEL_MAX_SECONDS: Partial<Record<ModelId, number>> = {
  "grok-imagine": 30,
  "veo-3-1": 8,
  "seedance-2": 15,
  "seedance-2-5": 30,
  "gemini-omni": 10,
};

/**
 * Durée maximale par vidéo selon l'offre et le modèle.
 * Au-delà de cette limite (et dans la limite du modèle), la durée affiche un cadenas.
 * Une offre absente de cette table n'a pas de plafond propre : seule la limite du modèle s'applique.
 * À CONFIRMER : Sam Flash Light, Seedance 2.5 = 20 s (ou 25 s). Offre d'essai Sam Flash, Seedance 2.5 = 15 s.
 */
const OFFER_MODEL_CAP: Record<string, Partial<Record<ModelId, number>>> = {
  free: {
    "grok-imagine": 15,
    "veo-3-1": 8,
    "seedance-2": 15,
    "seedance-2-5": 15,
  },
  sam_flash_light: {
    "grok-imagine": 20,
    "veo-3-1": 8,
    "seedance-2": 15,
    "seedance-2-5": 20,
  },
};

/** Durée maximale d'une vidéo pour une offre et un modèle donnés. */
export function clipCapFor(plan: string | null | undefined, modelId?: ModelId): number {
  const modelMax = modelId ? (MODEL_MAX_SECONDS[modelId] ?? 15) : 30;
  if (!modelId) return modelMax;
  const offerCap = OFFER_MODEL_CAP[plan ?? "free"]?.[modelId];
  return offerCap ?? modelMax;
}

/** Durée maximale d'un modèle (limite technique seule). */
export function modelMaxSeconds(id: ModelId): number {
  return MODEL_MAX_SECONDS[id] ?? 15;
}
