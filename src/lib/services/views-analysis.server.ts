/**
 * Lecture des vues sur une capture d'écran ou une vidéo d'écran, par Gemini (via KIE).
 * Serveur uniquement. Le résultat est une proposition : l'administrateur valide le chiffre final.
 */
import { analyzeWithGemini, analyzeVideoUrl, type GeminiImage } from "@/lib/services/gemini.server";

export type ViewsReading = {
  views: number | null;
  platform: string | null;
  confidence: number;
  note: string;
};

const PROMPT = `Tu lis une capture d'écran ou une vidéo d'écran d'un compte de réseau social.
Trouve le nombre de vues de la vidéo indiquée. Réponds UNIQUEMENT avec un objet JSON, sans texte autour, sans balises markdown :
{"views": <entier ou null>, "platform": "<tiktok|youtube|instagram|facebook|autre|null>", "confidence": <nombre entre 0 et 1>, "note": "<une phrase en français>"}
Si le nombre de vues n'est pas lisible ou absent, mets "views": null et une confiance basse. N'invente jamais un chiffre.`;

const MAX_BYTES = 12 * 1024 * 1024;
const TIMEOUT_MS = 25_000;

function parseReading(text: string): ViewsReading | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try {
    const raw = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    const views = typeof raw.views === "number" && Number.isFinite(raw.views) && raw.views >= 0 ? Math.floor(raw.views) : null;
    const confidence = typeof raw.confidence === "number" ? Math.min(1, Math.max(0, raw.confidence)) : 0;
    return {
      views,
      platform: typeof raw.platform === "string" ? raw.platform.slice(0, 20) : null,
      confidence,
      note: typeof raw.note === "string" ? raw.note.slice(0, 300) : "",
    };
  } catch {
    return null;
  }
}

function isVideoUrl(url: string, contentType: string | null): boolean {
  if (contentType?.startsWith("video/")) return true;
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

/** Lit les vues sur une capture ou une vidéo. Renvoie null si la lecture échoue. */
export async function readViewsFromEvidence(url: string): Promise<ViewsReading | null> {
  if (!/^https:\/\//.test(url)) return null;
  const work = (async (): Promise<ViewsReading | null> => {
    const head = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8_000) }).catch(() => null);
    const contentType = head?.headers.get("content-type") ?? null;

    if (isVideoUrl(url, contentType)) {
      const r = await analyzeVideoUrl({ videoUrl: url, prompt: PROMPT });
      return r.ok ? parseReading(r.text) : null;
    }

    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (!res || !res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0];
    if (!["image/jpeg", "image/png", "image/webp"].includes(type)) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return null;
    const image: GeminiImage = { mimeType: type as GeminiImage["mimeType"], data: Buffer.from(bytes).toString("base64") };
    const r = await analyzeWithGemini({ prompt: PROMPT, images: [image], thinking: "low" });
    return r.ok ? parseReading(r.text) : null;
  })();

  // Ne bloque jamais l'envoi d'une vidéo au-delà de 25 secondes.
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS));
  return Promise.race([work.catch(() => null), timeout]);
}
