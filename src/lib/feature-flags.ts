/**
 * Interrupteurs de publication.
 * Règle : l'administrateur voit toujours la fonctionnalité (en aperçu),
 * les utilisateurs la voient seulement si elle est publiée.
 * Ce fichier ne contient aucun secret.
 */
export const FEATURE_KEYS = [
  "creator_studio", // espace créateur /app (modèles, outils, durées)
  "seller_studio", // espace vendeur (influenceurs, voix off)
  "voice_library", // bibliothèque de voix
  "creator_dashboard", // tableau de bord créateur (profil, vidéos, revenus)
  "monetization_requests", // demandes de participation à la monétisation
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type FeatureFlags = Partial<Record<FeatureKey, boolean>>;

export function parseFeatureFlags(raw: unknown): FeatureFlags {
  if (!raw || typeof raw !== "object") return {};
  const out: FeatureFlags = {};
  for (const key of FEATURE_KEYS) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === "boolean") out[key] = v;
  }
  return out;
}

/** Vrai si la fonctionnalité doit s'afficher pour cet utilisateur. */
export function isFeatureVisible(key: FeatureKey, flags: FeatureFlags, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  return flags[key] === true;
}
