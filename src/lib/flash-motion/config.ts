/**
 * Réglages Flash Motion AI. Tout passe par KIE (clé : KIE_API_KEY).
 * Pour ajouter ou retirer un modèle d'écriture, modifiez CODE_MODELS.
 */
export type Provider = "gpt" | "claude";

export type ModelOption = { id: string; label: string; provider: Provider };

/** Modèles proposés à l'utilisateur pour écrire l'animation. Identifiants Kie.ai déjà utilisés dans le projet. */
export const CODE_MODELS: ModelOption[] = [
  { id: "gpt-6-astra", label: "GPT 6 Astra", provider: "gpt" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", provider: "claude" },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8 (le plus précis)", provider: "claude" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (le plus rapide)", provider: "claude" },
];

export const DEFAULT_CODE_MODEL = "gpt-6-astra";

export const FLASH_MOTION = {
  // Modèle qui écrit le script de la voix off (peu coûteux).
  scriptModel: "claude-haiku-5-5",
  // Voix off ElevenLabs via KIE (identifiant documenté par KIE).
  ttsModel: "elevenlabs/text-to-speech-multilingual-v2",
  // Voix choisie dans la liste KIE. Par défaut : James (EkK5I93UQWFDigLMpZcX).
  // Peut être changée avec la variable KIE_TTS_VOICE (une voix de la liste).
  ttsVoice: process.env.KIE_TTS_VOICE ?? "EkK5I93UQWFDigLMpZcX",
  width: 1080,
  height: 1920,
  fps: 30,
  minDurationSeconds: 6,
  maxDurationSeconds: 60,
} as const;

/** Retrouve un modèle autorisé. Refuse tout identifiant hors liste. */
export function resolveCodeModel(id: string | null | undefined): ModelOption {
  return CODE_MODELS.find((m) => m.id === id) ?? CODE_MODELS.find((m) => m.id === DEFAULT_CODE_MODEL)!;
}
