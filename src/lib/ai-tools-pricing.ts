import { kieCreditsToSamCredits } from "@/lib/ai-pricing";

export type AiTool = "avatar" | "clone";

export type AiVariant = {
  id: string;
  label: string;
  hint: string;
  model: string;
  /** Prix Kie.ai en crédits par seconde (documentation Kie.ai). */
  kieRate: number;
  mode?: "720p" | "1080p";
  /** kling : Motion Control ; seedance : Seedance 2.5 (référence vidéo + image). */
  provider?: "kling" | "seedance";
};

export const AVATAR_VARIANTS: AiVariant[] = [
  { id: "standard", label: "Standard 720p", hint: "Rapide et économique", model: "kling/ai-avatar-standard", kieRate: 8 },
  { id: "pro", label: "Pro 1080p", hint: "Meilleure qualité", model: "kling/ai-avatar-pro", kieRate: 16 },
];

export const CLONE_VARIANTS: AiVariant[] = [
  // Tarifs Kie par seconde, repris de creator-pricing.ts (PER_SECOND_KIE).
  { id: "sd25-480", label: "Seedance 2.5 480p", hint: "Le moins cher, jusqu'à 30 secondes", model: "bytedance/seedance-2-5", kieRate: 28, mode: "480p", provider: "seedance" },
  { id: "sd25-720", label: "Seedance 2.5 720p", hint: "Jusqu'à 30 secondes", model: "bytedance/seedance-2-5", kieRate: 63, mode: "720p", provider: "seedance" },
  { id: "sd25-1080", label: "Seedance 2.5 1080p", hint: "Meilleure qualité, jusqu'à 30 secondes", model: "bytedance/seedance-2-5", kieRate: 158, mode: "1080p", provider: "seedance" },
  { id: "sd20-720", label: "Seedance 2.0 720p", hint: "Jusqu'à 15 secondes", model: "bytedance/seedance-2", kieRate: 41, mode: "720p", provider: "seedance" },
  { id: "sd20-1080", label: "Seedance 2.0 1080p", hint: "Meilleure qualité, jusqu'à 15 secondes", model: "bytedance/seedance-2", kieRate: 102, mode: "1080p", provider: "seedance" },
  { id: "k26-720", label: "Standard 720p", hint: "Kling 2.6", model: "kling-2.6/motion-control", kieRate: 11, mode: "720p", provider: "kling" },
  { id: "k26-1080", label: "Standard 1080p", hint: "Kling 2.6", model: "kling-2.6/motion-control", kieRate: 18, mode: "1080p", provider: "kling" },
  { id: "k30-720", label: "Premium 720p", hint: "Kling 3.0", model: "kling-3.0/motion-control", kieRate: 20, mode: "720p", provider: "kling" },
  { id: "k30-1080", label: "Premium 1080p", hint: "Kling 3.0", model: "kling-3.0/motion-control", kieRate: 27, mode: "1080p", provider: "kling" },
];

export const AVATAR_MAX_SECONDS = 15;
export const CLONE_MIN_SECONDS = 3;
export const CLONE_MAX_SECONDS = 30;

export function variantsFor(tool: AiTool): AiVariant[] {
  return tool === "avatar" ? AVATAR_VARIANTS : CLONE_VARIANTS;
}

/** Coût par seconde en crédits Sam Flash, calculé à partir du tarif Kie de la variante. */
export function costPerSecond(variant: AiVariant): number {
  return kieCreditsToSamCredits(variant.kieRate);
}

/** Coût total en crédits Sam Flash (3 décimales, arrondi au-dessus). */
export function jobCost(variant: AiVariant, seconds: number): number {
  return Math.ceil(seconds * costPerSecond(variant) * 1000) / 1000;
}
