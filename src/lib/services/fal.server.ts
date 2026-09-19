/**
 * Moteur de génération média Fal.ai (xAI Grok Imagine).
 *
 * Clé serveur uniquement : process.env.FAL_KEY (secret Lovable Cloud).
 * Aucune clé n'est jamais exposée au navigateur.
 *
 * Endpoints utilisés :
 *  - Image (text-to-image)       : xai/grok-imagine            (fallback fal-ai/flux/schnell)
 *  - Vidéo depuis un prompt      : xai/grok-imagine-video/text-to-video
 *  - Vidéo depuis une image      : xai/grok-imagine-video/image-to-video
 *  - Retouche / montage vidéo    : xai/grok-imagine-video/edit-video
 */

export const FAL_MODELS = {
  image: "xai/grok-imagine",
  imageFallback: "fal-ai/flux/schnell",
  textToVideo: "xai/grok-imagine-video/text-to-video",
  imageToVideo: "xai/grok-imagine-video/image-to-video",
  editVideo: "xai/grok-imagine-video/edit-video",
} as const;

export type FalMediaRequest = {
  prompt: string;
  resolution: string;
  duration: string;
  aspectRatio: string;
  /** Image source pour l'image-to-video ou le montage vidéo. */
  imageUrl?: string | null;
  /** Vidéo source pour la retouche / le montage. */
  videoUrl?: string | null;
};

export type FalResult =
  | { ok: true; mediaUrl: string; contentType: string; bytes: Uint8Array | null }
  | { ok: false; error: string };

export type FalStartResult =
  | { ok: false; error: string }
  | { ok: true; isImmediate: true; mediaUrl: string; contentType: string; bytes: Uint8Array | null }
  | { ok: true; isImmediate: false; requestId: string; statusUrl: string; responseUrl: string };

export type FalStatusResult =
  | { status: "pending" }
  | { status: "error"; error: string }
  | { status: "completed"; mediaUrl: string; contentType: string; bytes: Uint8Array | null };

const QUEUE_BASE = "https://queue.fal.run";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 8 * 60 * 1000;

export function isFalConfigured(): boolean {
  return Boolean(process.env["FAL_KEY"]);
}

function headers(): Record<string, string> {
  return {
    Authorization: `Key ${process.env["FAL_KEY"]}`,
    "Content-Type": "application/json",
  };
}

/** Résolution vidéo autorisée : 480p ou 720p uniquement. */
export function normalizeVideoResolution(res: string): "480p" | "720p" {
  return res === "480p" ? "480p" : "720p";
}

/** Durée vidéo plafonnée à 6 secondes. */
export function normalizeVideoDuration(duration: string): number {
  const parsed = Number.parseInt(duration, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 6;
  return Math.min(6, parsed);
}



function readError(payload: unknown, status: number, fallback: string): string {
  const obj = payload as { detail?: unknown; error?: unknown; message?: unknown } | null;
  const detail = obj?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && typeof (detail[0] as { msg?: string })?.msg === "string") {
    return (detail[0] as { msg: string }).msg;
  }
  if (typeof obj?.error === "string") return obj.error;
  if (typeof obj?.message === "string") return obj.message;
  return `${fallback} (${status})`;
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text.slice(0, 300) };
  }
}

async function download(
  url: string,
  fallbackType: string,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    return {
      bytes: new Uint8Array(buffer),
      contentType: res.headers.get("content-type") ?? fallbackType,
    };
  } catch {
    return null;
  }
}

type FalPayload = {
  images?: { url?: string; content_type?: string }[];
  image?: { url?: string; content_type?: string };
  video?: { url?: string; content_type?: string };
  videos?: { url?: string; content_type?: string }[];
  output?: { url?: string; content_type?: string };
};

function extractMedia(payload: FalPayload, kind: "image" | "video") {
  if (kind === "image") {
    return payload.images?.[0] ?? payload.output ?? undefined;
  }
  return payload.video ?? payload.videos?.[0] ?? payload.output ?? undefined;
}
async function finalize(
  media: { url?: string; content_type?: string },
  kind: "image" | "video",
): Promise<FalStartResult & { isImmediate: true }> {
  const fallbackType = kind === "video" ? "video/mp4" : "image/jpeg";
  const downloaded = await download(media.url!, media.content_type ?? fallbackType);
  if (!downloaded) return { ok: false, error: "Média généré mais inaccessible." };
  return {
    ok: true,
    isImmediate: true,
    mediaUrl: media.url!,
    contentType: downloaded.contentType,
    bytes: downloaded.bytes,
  };
}

/** 
 * Lance la génération sur Fal.ai.
 * Retourne soit le média immédiat, soit les informations de file d'attente.
 */
export async function startModel(
  model: string,
  input: Record<string, unknown>,
  kind: "image" | "video",
): Promise<FalStartResult> {
  if (!isFalConfigured()) return { ok: false, error: "Moteur de génération indisponible." };

  let submit: Response;
  try {
    submit = await fetch(`${QUEUE_BASE}/${model}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(input),
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Appel Fal.ai impossible" };
  }

  const submitJson = (await parseJson(submit)) as {
    request_id?: string;
    status_url?: string;
    response_url?: string;
  } & FalPayload;

  if (!submit.ok) {
    return { ok: false, error: readError(submitJson, submit.status, `Modèle ${model} indisponible`) };
  }

  // Réponse synchrone (certains modèles répondent immédiatement).
  const immediate = extractMedia(submitJson, kind);
  if (!submitJson.request_id && immediate?.url) {
    return finalize(immediate, kind);
  }

  if (!submitJson.request_id) {
    return { ok: false, error: "Aucun request_id renvoyé par Fal.ai" };
  }

  const statusUrl = submitJson.status_url ?? `${QUEUE_BASE}/${model}/requests/${submitJson.request_id}/status`;
  const responseUrl = submitJson.response_url ?? `${QUEUE_BASE}/${model}/requests/${submitJson.request_id}`;

  return {
    ok: true,
    isImmediate: false,
    requestId: submitJson.request_id,
    statusUrl,
    responseUrl,
  };
}

/** 
 * Vérifie l'état d'une requête Fal en cours et finalise le téléchargement si terminé.
 */
export async function checkModelStatus(
  statusUrl: string,
  responseUrl: string,
  kind: "image" | "video"
): Promise<FalStatusResult> {
  let statusRes: Response;
  try {
    statusRes = await fetch(statusUrl, { headers: headers() });
  } catch {
    return { status: "pending" };
  }

  const statusJson = (await parseJson(statusRes)) as { status?: string };
  if (!statusRes.ok) {
    return { status: "error", error: readError(statusJson, statusRes.status, "Suivi de génération échoué") };
  }

  const status = (statusJson.status ?? "").toUpperCase();
  if (status === "IN_PROGRESS" || status === "IN_QUEUE") {
    return { status: "pending" };
  }

  if (status === "COMPLETED") {
    const resultRes = await fetch(responseUrl, { headers: headers() });
    const resultJson = (await parseJson(resultRes)) as FalPayload;
    if (!resultRes.ok) {
      return { status: "error", error: readError(resultJson, resultRes.status, "Résultat indisponible") };
    }
    const media = extractMedia(resultJson, kind);
    if (!media?.url) return { status: "error", error: "Aucun média renvoyé par le moteur." };
    
    const fallbackType = kind === "video" ? "video/mp4" : "image/jpeg";
    const downloaded = await download(media.url, media.content_type ?? fallbackType);
    if (!downloaded) return { status: "error", error: "Média généré mais inaccessible." };
    
    return {
      status: "completed",
      mediaUrl: media.url,
      contentType: downloaded.contentType,
      bytes: downloaded.bytes,
    };
  }

  if (status === "FAILED" || status === "ERROR" || status === "CANCELLED") {
    return { status: "error", error: readError(statusJson, 500, `Génération ${status.toLowerCase()}`) };
  }

  return { status: "pending" };
}

/** Image (text-to-image) avec repli automatique sur Flux Schnell. */
export async function generateImageWithFal(req: FalMediaRequest): Promise<FalStartResult> {
  const primary = await startModel(
    FAL_MODELS.image,
    {
      prompt: req.prompt,
      aspect_ratio: normalizeAspect(req.aspectRatio),
      num_images: 1,
    },
    "image",
  );
  if (primary.ok) return primary;

  const fallback = await startModel(
    FAL_MODELS.imageFallback,
    {
      prompt: req.prompt,
      image_size: aspectToFluxSize(req.aspectRatio),
      num_images: 1,
    },
    "image",
  );
  if (fallback.ok) return fallback;

  return { ok: false, error: `${primary.error} ; repli : ${fallback.error}` };
}

function normalizeAspect(ratio: string): string {
  const parts = ratio.split(":");
  if (parts.length !== 2) return "16:9";
  const num = Number(parts[0]);
  const den = Number(parts[1]);
  if (num > den && num / den > 1.8) return "21:9";
  if (num > den && num / den < 1.4) return "4:3";
  if (num > den) return "16:9";
  if (num < den && den / num > 1.4) return "9:16";
  if (num < den) return "3:4";
  return "1:1";
}

function aspectToFluxSize(ratio: string): string {
  switch (normalizeAspect(ratio)) {
    case "16:9":
    case "21:9":
      return "landscape_16_9";
    case "4:3":
    case "3:2":
      return "landscape_4_3";
    case "1:1":
      return "square_hd";
    case "3:4":
    case "2:3":
      return "portrait_4_3";
    default:
      return "portrait_16_9";
  }
}

/** Vidéo depuis un prompt texte (480p/720p, 6 s max). */
export async function generateVideoWithFal(req: FalMediaRequest): Promise<FalStartResult> {
  const duration = normalizeVideoDuration(req.duration);
  const resolution = normalizeVideoResolution(req.resolution);

  if (req.videoUrl) {
    return startModel(
      FAL_MODELS.editVideo,
      {
        prompt: req.prompt,
        video_url: req.videoUrl,
        resolution,
        duration,
      },
      "video",
    );
  }

  if (req.imageUrl) {
    return startModel(
      FAL_MODELS.imageToVideo,
      {
        prompt: req.prompt,
        image_url: req.imageUrl,
        resolution,
        duration,
        aspect_ratio: normalizeAspect(req.aspectRatio),
      },
      "video",
    );
  }

  return startModel(
    FAL_MODELS.textToVideo,
    {
      prompt: req.prompt,
      resolution,
      duration,
      aspect_ratio: normalizeAspect(req.aspectRatio),
    },
    "video",
  );
}
