/**
 * Génération vidéo via Kie.ai pour Seedance 2.0, Seedance 2.5 et Veo 3.1,
 * et extension Grok Imagine. Paramètres conformes aux documentations KIE.
 * Clé côté serveur uniquement : KIE_API_KEY.
 */

const BASE = "https://api.kie.ai/api/v1/jobs";

/** Identifiant interne → identifiant envoyé à KIE. */
export const KIE_CREATOR_MODELS = {
  "seedance-2": "bytedance/seedance-2",
  "seedance-2-5": "bytedance/seedance-2-5",
  "veo-3-1": "veo-3-1",
} as const;

export type KieCreatorModelId = keyof typeof KIE_CREATOR_MODELS;

export type CreatorGenerationMode = "text" | "image" | "reference" | "clone";

export type VeoTier = "lite" | "fast" | "quality";

export function isKieCreatorModel(id: string | null | undefined): id is KieCreatorModelId {
  return !!id && Object.prototype.hasOwnProperty.call(KIE_CREATOR_MODELS, id);
}

export type KieCreatorTaskInput = {
  model: KieCreatorModelId;
  mode: CreatorGenerationMode;
  prompt: string;
  /** Mode « image » : photo de départ. Mode « référence » Veo : une à trois images. */
  imageUrls?: string[];
  /** Mode « référence » : images de référence. Seedance seulement. */
  referenceImageUrls?: string[];
  /** Mode « référence » et « clonage » : vidéos source ou de référence. */
  videoUrls?: string[];
  /** Mode « référence » : audios de référence. Seedance seulement. */
  audioUrls?: string[];
  resolution: "480p" | "720p" | "1080p";
  aspectRatio: string;
  duration: number;
  /** Veo seulement. Par défaut : rapide. */
  tier?: VeoTier;
  callBackUrl?: string;
};

export type KieCreatorResult = { ok: true; taskId: string } | { ok: false; message: string };

const SEEDANCE_ASPECTS = ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"];
const VEO_ASPECTS = ["16:9", "9:16"];

/** Limites de durée par modèle (documentation KIE). */
function clampSeedanceDuration(model: "seedance-2" | "seedance-2-5", seconds: number): number {
  const s = Math.round(seconds);
  return model === "seedance-2" ? Math.min(15, Math.max(4, s)) : Math.min(30, Math.max(4, s));
}

/** Veo 3.1 n'accepte que 4, 6 ou 8 secondes. En référence, seulement 8. */
function veoDuration(seconds: number, reference: boolean): number {
  if (reference) return 8;
  return [4, 6, 8].reduce((best, d) => (Math.abs(d - seconds) < Math.abs(best - seconds) ? d : best), 4);
}

const VEO_MODEL_BY_TIER: Record<VeoTier, string> = {
  lite: "veo3_lite",
  fast: "veo3_fast",
  quality: "veo3",
};

/** Construit le corps de la requête, ou renvoie une erreur lisible. */
function buildBody(input: KieCreatorTaskInput): { ok: true; body: Record<string, unknown> } | { ok: false; message: string } {
  const prompt = input.prompt.slice(0, 20000);

  if (input.model === "veo-3-1") {
    const aspect = VEO_ASPECTS.includes(input.aspectRatio) ? input.aspectRatio : "16:9";
    const tier = input.tier ?? "fast";

    if (input.mode === "clone") {
      return { ok: false, message: "Le clonage vidéo n'est pas disponible avec Veo 3.1." };
    }
    if (input.mode === "reference") {
      // Référence Veo : Rapide ou Lite seulement, 1 à 3 images, 8 secondes.
      if (tier === "quality") return { ok: false, message: "La référence n'est pas disponible en qualité maximale." };
      const images = (input.imageUrls ?? []).slice(0, 3);
      if (images.length === 0) return { ok: false, message: "Ajoutez au moins une image de référence." };
      return {
        ok: true,
        body: {
          model: "veo-3-1",
          input: {
            prompt,
            model: VEO_MODEL_BY_TIER[tier],
            generation_type: "REFERENCE_2_VIDEO",
            image_urls: images,
            aspect_ratio: aspect,
            resolution: input.resolution,
            duration: 8,
            enable_translation: true,
          },
        },
      };
    }

    const images = input.imageUrls ?? [];
    return {
      ok: true,
      body: {
        model: "veo-3-1",
        input: {
          prompt,
          model: VEO_MODEL_BY_TIER[tier],
          generation_type: images.length > 0 ? "FIRST_AND_LAST_FRAMES_2_VIDEO" : "TEXT_2_VIDEO",
          ...(images.length > 0 ? { image_urls: images.slice(0, 2) } : {}),
          aspect_ratio: aspect,
          resolution: input.resolution,
          duration: veoDuration(input.duration, false),
          enable_translation: true,
        },
      },
    };
  }

  // Seedance 2.0 et 2.5 : même structure d'entrée.
  const aspect = SEEDANCE_ASPECTS.includes(input.aspectRatio) ? input.aspectRatio : "adaptive";
  const common = {
    prompt,
    resolution: input.resolution,
    aspect_ratio: aspect,
    duration: clampSeedanceDuration(input.model, input.duration),
    generate_audio: true,
    nsfw_checker: true,
  };
  const model = KIE_CREATOR_MODELS[input.model];

  if (input.mode === "text") {
    return { ok: true, body: { model, input: common } };
  }
  if (input.mode === "image") {
    const first = input.imageUrls?.[0];
    if (!first) return { ok: false, message: "Ajoutez une photo de départ." };
    return { ok: true, body: { model, input: { ...common, first_frame_url: first } } };
  }
  if (input.mode === "clone") {
    const videos = input.videoUrls ?? [];
    if (videos.length === 0) return { ok: false, message: "Ajoutez une vidéo à cloner." };
    return { ok: true, body: { model, input: { ...common, reference_video_urls: videos.slice(0, 3) } } };
  }
  // Référence : images, vidéos et audios de référence (sans image de départ).
  const refImages = (input.referenceImageUrls ?? []).slice(0, input.model === "seedance-2" ? 9 : 30);
  const refVideos = (input.videoUrls ?? []).slice(0, input.model === "seedance-2" ? 3 : 10);
  const refAudios = (input.audioUrls ?? []).slice(0, input.model === "seedance-2" ? 3 : 10);
  if (refImages.length + refVideos.length + refAudios.length === 0) {
    return { ok: false, message: "Ajoutez au moins une référence." };
  }
  return {
    ok: true,
    body: {
      model,
      input: {
        ...common,
        ...(refImages.length ? { reference_image_urls: refImages } : {}),
        ...(refVideos.length ? { reference_video_urls: refVideos } : {}),
        ...(refAudios.length ? { reference_audio_urls: refAudios } : {}),
      },
    },
  };
}

async function postCreateTask(body: Record<string, unknown>): Promise<KieCreatorResult> {
  const key = process.env.KIE_API_KEY ?? "";
  if (!key) return { ok: false, message: "Service vidéo indisponible." };
  try {
    const res = await fetch(`${BASE}/createTask`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    const taskId = json?.data?.taskId as string | undefined;
    // KIE renvoie HTTP 200 même en cas d'erreur : on vérifie toujours le champ code.
    if (!res.ok || json.code !== 200 || !taskId) {
      console.error("[kie-creator] createTask", res.status, JSON.stringify(json).slice(0, 400));
      return { ok: false, message: "La génération n'a pas pu démarrer." };
    }
    return { ok: true, taskId };
  } catch (error) {
    console.error("[kie-creator] createTask impossible", error);
    return { ok: false, message: "La génération n'a pas pu démarrer." };
  }
}

/** Crée une tâche de génération pour Seedance ou Veo, selon le mode demandé. */
export async function createKieCreatorTask(input: KieCreatorTaskInput): Promise<KieCreatorResult> {
  const built = buildBody(input);
  if (!built.ok) return built;
  const body = { ...built.body };
  if (input.callBackUrl) body.callBackUrl = input.callBackUrl;
  return postCreateTask(body);
}

/**
 * Extension d'une vidéo Grok Imagine déjà créée sur KIE.
 * taskId : identifiant d'une tâche Grok réussie (text-to-video ou image-to-video).
 */
export async function createKieGrokExtendTask(input: {
  taskId: string;
  prompt: string;
  extendTimes: 6 | 10;
  extendAt?: number;
}): Promise<KieCreatorResult> {
  if (!input.taskId) return { ok: false, message: "Vidéo source introuvable." };
  return postCreateTask({
    model: "grok-imagine/extend",
    input: {
      task_id: input.taskId,
      prompt: input.prompt.slice(0, 5000),
      extend_at: Math.max(2, input.extendAt ?? 2),
      extend_times: String(input.extendTimes),
    },
  });
}
