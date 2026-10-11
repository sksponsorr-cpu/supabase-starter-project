/**
 * Génération vidéo via Kie.ai (modèle Grok Imagine Video 1.5 preview).
 * Clé côté serveur uniquement : KIE_API_KEY.
 */

const BASE = "https://api.kie.ai/api/v1/jobs";
export const GROK_VIDEO_MODEL = "grok-imagine-video-1-5-preview";

export type GrokResolution = "480p" | "720p" | "1080p";
export type GrokAspect = "auto" | "1:1" | "16:9" | "9:16" | "3:2" | "2:3";

/**
 * Crédits Sam Flash facturés par seconde : 480p = 1, 720p = 2, 1080p = 4.
 * Coût Kie : 480p 2,4 cr., 720p 4,5 cr., 1080p 8 cr. (1 cr. Kie = 0,005 $, majoration 60 %).
 */
export function grokVideoCredits(resolution: GrokResolution, seconds: number): number {
  const perSecond = resolution === "1080p" ? 4 : resolution === "720p" ? 2 : 1;
  return perSecond * Math.max(1, Math.round(seconds));
}

export async function createGrokVideoTask(input: {
  prompt: string;
  imageUrls: string[];
  aspectRatio?: GrokAspect;
  resolution: GrokResolution;
  duration: number;
  callBackUrl?: string;
}): Promise<{ ok: true; taskId: string } | { ok: false; message: string }> {
  const key = process.env.KIE_API_KEY ?? "";
  if (!key) return { ok: false, message: "Service vidéo indisponible." };
  if (input.duration < 1 || input.duration > 15) return { ok: false, message: "Durée entre 1 et 15 secondes." };

  const body: Record<string, unknown> = {
    model: GROK_VIDEO_MODEL,
    input: {
      prompt: input.prompt.slice(0, 4096),
      image_urls: input.imageUrls,
      aspect_ratio: input.aspectRatio ?? "auto",
      resolution: input.resolution,
      duration: Math.round(input.duration),
      nsfw_checker: true,
    },
  };
  if (input.callBackUrl) body.callBackUrl = input.callBackUrl;

  try {
    const res = await fetch(`${BASE}/createTask`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    const taskId = json?.data?.taskId as string | undefined;
    if (!res.ok || json.code !== 200 || !taskId) {
      console.error("[kie-video] createTask", res.status, JSON.stringify(json).slice(0, 400));
      return { ok: false, message: "La génération n'a pas pu démarrer." };
    }
    return { ok: true, taskId };
  } catch (error) {
    console.error("[kie-video] createTask impossible", error);
    return { ok: false, message: "La génération n'a pas pu démarrer." };
  }
}

export async function getGrokVideoTask(taskId: string): Promise<
  | { ok: true; state: "waiting" | "success" | "fail"; resultUrl: string | null; failMsg: string | null }
  | { ok: false; message: string }
> {
  const key = process.env.KIE_API_KEY ?? "";
  if (!key) return { ok: false, message: "Service vidéo indisponible." };
  try {
    const res = await fetch(`${BASE}/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const json = await res.json();
    if (!res.ok || json.code !== 200 || !json.data) return { ok: false, message: "Suivi indisponible." };
    const d = json.data as { state: string; resultJson?: string; failMsg?: string | null };
    let resultUrl: string | null = null;
    try {
      resultUrl = (JSON.parse(d.resultJson ?? "{}").resultUrls as string[] | undefined)?.[0] ?? null;
    } catch {
      resultUrl = null;
    }
    const state = d.state === "success" ? "success" : d.state === "fail" ? "fail" : "waiting";
    return { ok: true, state, resultUrl, failMsg: d.failMsg ?? null };
  } catch (error) {
    console.error("[kie-video] recordInfo impossible", error);
    return { ok: false, message: "Suivi indisponible." };
  }
}

/** Grok Imagine (image vers vidéo), modèle Kie.ai "grok-imagine/image-to-video". Audio synchronisé, non désactivable. */
export const GROK_IMAGINE_MODEL = "grok-imagine/image-to-video";

export async function createGrokImagineTask(input: {
  prompt: string;
  imageUrls: string[];
  resolution: GrokResolution;
  duration: number;
  aspectRatio?: "16:9" | "9:16" | "1:1" | "3:2" | "2:3";
  callBackUrl?: string;
}): Promise<{ ok: true; taskId: string } | { ok: false; message: string }> {
  const key = process.env.KIE_API_KEY ?? "";
  if (!key) return { ok: false, message: "Service vidéo indisponible." };
  if (input.imageUrls.length === 0) return { ok: false, message: "Ajoute une image de départ." };
  const duration = Math.round(input.duration);
  if (duration < 6 || duration > 30) return { ok: false, message: "Durée entre 6 et 30 secondes." };

  const body: Record<string, unknown> = {
    model: GROK_IMAGINE_MODEL,
    input: {
      image_urls: input.imageUrls.slice(0, 1),
      prompt: input.prompt.slice(0, 4096),
      mode: "normal",
      duration: String(duration),
      resolution: input.resolution.toLowerCase(),
      aspect_ratio: input.aspectRatio ?? "16:9",
    },
  };
  if (input.callBackUrl) body.callBackUrl = input.callBackUrl;

  try {
    const res = await fetch(`${BASE}/createTask`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    const taskId = json?.data?.taskId as string | undefined;
    if (!res.ok || json.code !== 200 || !taskId) {
      console.error("[kie-grok] createTask", res.status, JSON.stringify(json).slice(0, 400));
      return { ok: false, message: "La génération n'a pas pu démarrer." };
    }
    return { ok: true, taskId };
  } catch (error) {
    console.error("[kie-grok] createTask impossible", error);
    return { ok: false, message: "La génération n'a pas pu démarrer." };
  }
}
