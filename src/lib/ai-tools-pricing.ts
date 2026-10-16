
export type AiTool = "avatar" | "clone";

export type AiVariant = {
  id: string;
  label: string;
  hint: string;
  model: string;
  /** Prix Kie.ai en crédits par seconde (documentation Kie.ai). */
  kieRate: number;
  mode?: "720p" | "1080p";
};

export const AVATAR_VARIANTS: AiVariant[] = [
  { id: "standard", label: "Standard 720p", hint: "Rapide et économique", model: "kling/ai-avatar-standard", kieRate: 8 },
  { id: "pro", label: "Pro 1080p", hint: "Meilleure qualité", model: "kling/ai-avatar-pro", kieRate: 16 },
];

export const CLONE_VARIANTS: AiVariant[] = [
  { id: "k26-720", label: "Standard 720p", hint: "Kling 2.6", model: "kling-2.6/motion-control", kieRate: 11, mode: "720p" },
  { id: "k26-1080", label: "Standard 1080p", hint: "Kling 2.6", model: "kling-2.6/motion-control", kieRate: 18, mode: "1080p" },
  { id: "k30-720", label: "Premium 720p", hint: "Kling 3.0", model: "kling-3.0/motion-control", kieRate: 20, mode: "720p" },
  { id: "k30-1080", label: "Premium 1080p", hint: "Kling 3.0", model: "kling-3.0/motion-control", kieRate: 27, mode: "1080p" },
];

export const AVATAR_MAX_SECONDS = 15;
export const CLONE_MIN_SECONDS = 3;
export const CLONE_MAX_SECONDS = 30;

export function variantsFor(tool: AiTool): AiVariant[] {
  return tool === "avatar" ? AVATAR_VARIANTS : CLONE_VARIANTS;
}

/** Coût en crédits Sam Flash (3 décimales, arrondi au-dessus). */
export function jobCost(_variant: AiVariant, seconds: number): number {
  // Règle fixe : 1 seconde = 100 crédits, quelle que soit la qualité.
  return Math.ceil(seconds * CREDITS_PER_SECOND);
}

/** Crédits par seconde pour les outils clonage et avatar. */
export const CREDITS_PER_SECOND = 100;

/** Coût par seconde, pour l'affichage. */
export function costPerSecond(_variant: AiVariant): number {
  return CREDITS_PER_SECOND;
}
