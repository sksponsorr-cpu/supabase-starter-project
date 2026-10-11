/**
 * Gemini Omni Flash 1.1 via KIE. Serveur uniquement : la clé KIE_API_KEY ne doit jamais être exposée.
 * Documentation : POST /api/v1/jobs/createTask · GET /api/v1/jobs/recordInfo?taskId=…
 */
const KIE_BASE = "https://api.kie.ai/api/v1/jobs";
const OMNI_MODEL = "google/gemini-omni-flash-1-1";
const ALLOWED_DURATIONS = [4, 6, 8, 10] as const;
const ALLOWED_RESOLUTIONS = ["360p", "720p", "1080p"] as const;
const ALLOWED_ASPECTS = ["16:9", "9:16"] as const;

export type OmniInput = {
  prompt: string;
  durationSec: (typeof ALLOWED_DURATIONS)[number];
  resolution: (typeof ALLOWED_RESOLUTIONS)[number];
  aspectRatio: (typeof ALLOWED_ASPECTS)[number];
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  imageUrls?: string[];
  seed?: number;
};

export type OmniCreateResult = { ok: true; taskId: string } | { ok: false; message: string };

export type OmniStatus =
  | { state: "waiting" }
  | { state: "success"; resultUrl: string }
  | { state: "fail"; failMsg: string }
  | { state: "error"; message: string };

function apiKey(): string | null {
  const key = process.env.KIE_API_KEY;
  return key && key.trim() ? key.trim() : null;
}

function kieMessage(status: number, msg?: string): string {
  if (status === 402) return "Solde KIE insuffisant. Rechargez le compte KIE.";
  if (status === 401) return "Clé KIE invalide. Vérifiez KIE_API_KEY sur Vercel.";
  if (status === 429) return "Trop de demandes chez KIE. Réessayez dans un instant.";
  return msg || "Erreur du fournisseur KIE.";
}

/** Lance une génération Omni. Renvoie l'identifiant de tâche à suivre. */
export async function createOmniTask(input: OmniInput): Promise<OmniCreateResult> {
  const key = apiKey();
  if (!key) return { ok: false, message: "Le moteur KIE n'est pas configuré (KIE_API_KEY manquant)." };

  if (!input.prompt || input.prompt.trim().length === 0) return { ok: false, message: "Le prompt est vide." };
  if (input.prompt.length > 20000) return { ok: false, message: "Le prompt dépasse 20 000 caractères." };
  if (!(ALLOWED_DURATIONS as readonly number[]).includes(input.durationSec))
    return { ok: false, message: "Durée non prise en charge : 4, 6, 8 ou 10 secondes." };
  if (!(ALLOWED_RESOLUTIONS as readonly string[]).includes(input.resolution))
    return { ok: false, message: "Résolution non prise en charge : 360p, 720p ou 1080p." };
  if (!(ALLOWED_ASPECTS as readonly string[]).includes(input.aspectRatio))
    return { ok: false, message: "Format non pris en charge : 16:9 ou 9:16." };

  const body = {
    model: OMNI_MODEL,
    input: {
      prompt: input.prompt,
      duration: String(input.durationSec),
      resolution: input.resolution,
      aspect_ratio: input.aspectRatio,
      ...(input.firstFrameUrl ? { first_frame_url: input.firstFrameUrl } : {}),
      ...(input.lastFrameUrl ? { last_frame_url: input.lastFrameUrl } : {}),
      ...(input.imageUrls?.length ? { image_urls: input.imageUrls } : {}),
      audio_ids: [],
      character_ids: [],
      ...(input.seed !== undefined ? { seed: input.seed } : {}),
    },
  };

  try {
    const res = await fetch(`${KIE_BASE}/createTask`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const json = (await res.json().catch(() => null)) as {
      code?: number;
      msg?: string;
      data?: { taskId?: string };
    } | null;
    if (!res.ok || !json || json.code !== 200 || !json.data?.taskId) {
      return { ok: false, message: kieMessage(res.status, json?.msg) };
    }
    return { ok: true, taskId: json.data.taskId };
  } catch {
    return { ok: false, message: "KIE est injoignable pour le moment. Réessayez." };
  }
}

/** Suit une tâche Omni. À appeler jusqu'à obtenir success ou fail. */
export async function getOmniTask(taskId: string): Promise<OmniStatus> {
  const key = apiKey();
  if (!key) return { state: "error", message: "KIE_API_KEY manquant." };

  try {
    const res = await fetch(`${KIE_BASE}/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json().catch(() => null)) as {
      code?: number;
      msg?: string;
      data?: { state?: string; resultJson?: string | null; failMsg?: string | null };
    } | null;
    if (!res.ok || !json || json.code !== 200 || !json.data) {
      return { state: "error", message: kieMessage(res.status, json?.msg) };
    }

    const state = json.data.state;
    if (state === "success") {
      let urls: string[] = [];
      try {
        urls = (JSON.parse(json.data.resultJson || "{}") as { resultUrls?: string[] }).resultUrls ?? [];
      } catch {
        urls = [];
      }
      if (!urls[0]) return { state: "error", message: "Résultat introuvable chez KIE." };
      return { state: "success", resultUrl: urls[0] };
    }
    if (state === "fail") return { state: "fail", failMsg: json.data.failMsg || "Génération refusée." };
    return { state: "waiting" };
  } catch {
    return { state: "error", message: "KIE est injoignable pour le moment. Réessayez." };
  }
}
