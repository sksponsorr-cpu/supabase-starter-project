/**
 * Gemini 3.6 Flash via KIE (format natif Gemini). Serveur uniquement : KIE_API_KEY ne doit jamais être exposée.
 * Endpoint : POST https://api.kie.ai/gemini/v1/models/gemini-3-6-flash:streamGenerateContent
 * Les erreurs reviennent avec un statut HTTP 200 et {"code": <int>, "msg": "..."} dans le corps.
 */
const GEMINI_URL = "https://api.kie.ai/gemini/v1/models/gemini-3-6-flash:streamGenerateContent";

export type GeminiImage = { mimeType: "image/jpeg" | "image/png" | "image/webp"; data: string };

/** Vidéo référencée par une URL publique (file_data), à héberger d'abord sur notre stockage. */
export type GeminiVideo = { mimeType: "video/mp4" | "video/webm" | "video/quicktime"; uri: string };

export type GeminiResult =
  | { ok: true; text: string; creditsConsumed: number }
  | { ok: false; message: string };

function kieMessage(code: number | undefined, msg?: string): string {
  if (code === 402) return "Solde KIE insuffisant. Rechargez le compte KIE.";
  if (code === 401) return "Clé KIE invalide. Vérifiez KIE_API_KEY sur Vercel.";
  if (code === 429) return "Trop de demandes chez KIE. Réessayez dans un instant.";
  return msg || "Erreur du fournisseur KIE.";
}

/** Extrait le texte de la réponse, qu'elle soit en JSON simple ou en flux (text/event-stream). */
function collectText(raw: string): { text: string; credits: number; code?: number; msg?: string } {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    const json = JSON.parse(trimmed) as {
      code?: number;
      msg?: string;
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      credits_consumed?: number;
    };
    if (json.code !== undefined && json.code !== 200) return { text: "", credits: 0, code: json.code, msg: json.msg };
    const text = (json.candidates ?? [])
      .flatMap((c) => c.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("");
    return { text, credits: Number(json.credits_consumed ?? 0) };
  }

  let text = "";
  let credits = 0;
  for (const line of trimmed.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const chunk = JSON.parse(payload) as {
        code?: number;
        msg?: string;
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        credits_consumed?: number;
      };
      if (chunk.code !== undefined && chunk.code !== 200) return { text: "", credits: 0, code: chunk.code, msg: chunk.msg };
      for (const c of chunk.candidates ?? []) {
        for (const p of c.content?.parts ?? []) text += p.text ?? "";
      }
      if (chunk.credits_consumed) credits = Number(chunk.credits_consumed);
    } catch {
      // Ligne non JSON : ignorée.
    }
  }
  return { text, credits };
}

/** Envoie un texte et des images à Gemini 3.6 Flash et renvoie la réponse texte. */
export async function analyzeWithGemini(args: {
  prompt: string;
  images?: GeminiImage[];
  videos?: GeminiVideo[];
  thinking?: "low" | "high";
}): Promise<GeminiResult> {
  const key = process.env.KIE_API_KEY?.trim();
  if (!key) return { ok: false, message: "Le moteur KIE n'est pas configuré (KIE_API_KEY manquant)." };
  if (!args.prompt.trim()) return { ok: false, message: "Le message est vide." };

  const parts: Record<string, unknown>[] = [
    ...(args.images ?? []).map((img) => ({ inline_data: { mime_type: img.mimeType, data: img.data } })),
    ...(args.videos ?? []).map((v) => ({ file_data: { mime_type: v.mimeType, file_uri: v.uri } })),
    { text: args.prompt },
  ];

  const body = {
    stream: false,
    contents: [{ role: "user", parts }],
    generationConfig: { thinkingConfig: { includeThoughts: false, thinkingLevel: args.thinking ?? "low" } },
  };

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90000),
    });
    const raw = await res.text();
    const parsed = collectText(raw);
    if (parsed.code !== undefined) return { ok: false, message: kieMessage(parsed.code, parsed.msg) };
    if (!res.ok) return { ok: false, message: kieMessage(res.status) };
    if (!parsed.text) return { ok: false, message: "Gemini n'a renvoyé aucun texte. Réessayez." };
    return { ok: true, text: parsed.text, creditsConsumed: parsed.credits };
  } catch {
    return { ok: false, message: "KIE est injoignable pour le moment. Réessayez." };
  }
}

/**
 * Analyse une vidéo complète via KIE (format compatible OpenAI).
 * La documentation indique que la vidéo passe par une URL publique, dans le même champ image_url que les images.
 * Le chemin du modèle 3.6 suit le modèle de la documentation 3.5 (à vérifier au premier appel).
 */
const GEMINI_OPENAI_URL = "https://api.kie.ai/gemini-3-6-flash-openai/v1/chat/completions";

export async function analyzeVideoUrl(args: { videoUrl: string; prompt: string }): Promise<GeminiResult> {
  const key = process.env.KIE_API_KEY?.trim();
  if (!key) return { ok: false, message: "Le moteur KIE n'est pas configuré (KIE_API_KEY manquant)." };
  if (!/^https:\/\//.test(args.videoUrl)) return { ok: false, message: "Adresse de la vidéo invalide." };

  const body = {
    stream: false,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: args.prompt },
          { type: "image_url", image_url: { url: args.videoUrl } },
        ],
      },
    ],
  };

  try {
    const res = await fetch(GEMINI_OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });
    const json = (await res.json().catch(() => null)) as {
      code?: number;
      msg?: string;
      choices?: { message?: { content?: string } }[];
      credits_consumed?: number;
    } | null;
    if (!json) return { ok: false, message: kieMessage(res.status) };
    if (json.code !== undefined && json.code !== 200) return { ok: false, message: kieMessage(json.code, json.msg) };
    const text = json.choices?.[0]?.message?.content ?? "";
    if (!text) return { ok: false, message: "Gemini n'a renvoyé aucun texte. Réessayez." };
    return { ok: true, text, creditsConsumed: Number(json.credits_consumed ?? 0) };
  } catch {
    return { ok: false, message: "KIE est injoignable pour le moment. Réessayez." };
  }
}
