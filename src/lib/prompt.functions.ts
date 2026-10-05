import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type EnhanceInput = {
  prompt: string;
  mediaType: "image" | "video";
  language?: string;
};

type EnhanceResult = { ok: true; prompt: string } | { ok: false; message: string };

const SYSTEM = `Tu es un directeur artistique expert en prompts pour la génération vidéo/image par IA.
Transforme l'idée simple de l'utilisateur en UN SEUL prompt riche, cinématographique et prêt à l'emploi.
Le prompt doit décrire, en prose fluide et dense (80 à 140 mots) :
- les détails visuels de la scène (sujet, décor, textures, palette, style) ;
- le mouvement de caméra (travelling, plan drone, ralenti, focale, profondeur de champ) ;
- l'éclairage et l'ambiance (heure dorée, néons, contre-jour, brume, contraste) ;
- pour la vidéo : une section audio explicite décrivant les effets sonores et l'ambiance.
Règles : réponds UNIQUEMENT par le prompt final, sans guillemets, sans titre, sans liste à puces,
sans commentaire ni explication. Écris dans la langue de l'utilisateur.`;

const clean = (t: string) => t.trim().replace(/^["'«»\s]+|["'«»\s]+$/g, "");

function userMessage(d: { prompt: string; mediaType: string; language: string }) {
  return `Type de média : ${d.mediaType === "video" ? "vidéo" : "image"}. Langue de réponse : ${d.language}.\nIdée : ${d.prompt}`;
}

const MODEL = "google/gemini-2.5-flash";

/** Extrait un court message lisible d'une réponse d'erreur. */
function shortBody(body: string): string {
  try {
    const j = JSON.parse(body) as { error?: { message?: string } | string; detail?: unknown; message?: string };
    const m =
      typeof j.error === "string" ? j.error : j.error?.message ?? (typeof j.detail === "string" ? j.detail : j.message);
    if (m) return String(m).slice(0, 140);
  } catch {
    /* pas du JSON */
  }
  return body.replace(/\s+/g, " ").slice(0, 140);
}

/** 1) fal.ai (utilise FAL_KEY, déjà configurée pour les vidéos) */
async function viaFal(d: { prompt: string; mediaType: string; language: string }): Promise<EnhanceResult> {
  const key = process.env["FAL_KEY"];
  if (!key) return { ok: false, message: "fal : clé FAL_KEY absente" };
  try {
    const res = await fetch("https://fal.run/fal-ai/any-llm", {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, system_prompt: SYSTEM, prompt: userMessage(d) }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error("[enhancePrompt] fal HTTP", res.status, body.slice(0, 300));
      return { ok: false, message: `fal : erreur ${res.status} ${shortBody(body)}` };
    }
    const json = JSON.parse(body) as { output?: string };
    const text = json.output ? clean(json.output) : "";
    return text ? { ok: true, prompt: text } : { ok: false, message: `fal : réponse vide ${shortBody(body)}` };
  } catch (e) {
    console.error("[enhancePrompt] fal error", e);
    return { ok: false, message: "fal : erreur réseau" };
  }
}

/** 2) Gemini directement chez Google (utilise GEMINI_API_KEY) */
async function viaGemini(d: { prompt: string; mediaType: string; language: string }): Promise<EnhanceResult> {
  const key = (
    process.env["GEMINI_API_KEY"] ??
    process.env["GOOGLE_API_KEY"] ??
    process.env["GOOGLE_GENERATIVE_AI_API_KEY"] ??
    ""
  ).trim();
  if (!key) return { ok: false, message: "Gemini : clé GEMINI_API_KEY absente" };

  // Modèle configurable (GEMINI_MODEL), sinon le plus récent, puis l'alias « latest » en secours.
  const models = [process.env["GEMINI_MODEL"], "gemini-3.8-flash", "gemini-flash-latest"].filter(
    (m, i, arr): m is string => Boolean(m) && arr.indexOf(m) === i,
  );

  let lastError = "";
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: "user", parts: [{ text: userMessage(d) }] }],
        }),
      });
      const body = await res.text();
      if (!res.ok) {
        console.error("[enhancePrompt] Gemini HTTP", model, res.status, body.slice(0, 300));
        lastError = `Gemini (${model}) : erreur ${res.status} ${shortBody(body)}`;
        if (res.status === 404) continue; // modèle retiré : essayer le suivant
        return { ok: false, message: lastError };
      }
      const json = JSON.parse(body) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const raw = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      const text = clean(raw);
      if (text) return { ok: true, prompt: text };
      lastError = `Gemini (${model}) : réponse vide ${shortBody(body)}`;
    } catch (e) {
      console.error("[enhancePrompt] Gemini error", e);
      lastError = "Gemini : erreur réseau";
    }
  }
  return { ok: false, message: lastError || "Gemini indisponible" };
}

export const enhancePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EnhanceInput) => {
    if (!input?.prompt?.trim()) throw new Error("Prompt requis");
    return {
      prompt: input.prompt.trim().slice(0, 1200),
      mediaType: input.mediaType === "image" ? ("image" as const) : ("video" as const),
      language: String(input.language ?? "fr").slice(0, 8),
    };
  })
  .handler(async ({ data }): Promise<EnhanceResult> => {
    // Ordre : fal -> Gemini (Google) -> xAI (si la clé existe un jour)
    const a = await viaFal(data);
    if (a.ok) return a;

    const b = await viaGemini(data);
    if (b.ok) return b;
    const reasons = [a, b].map((r) => (r.ok ? "" : r.message)).filter(Boolean).join(" | ");

    if (process.env["XAI_API_KEY"]) {
      const { enhancePromptWithXai } = await import("@/lib/services/xai.server");
      return enhancePromptWithXai(data);
    }
    return { ok: false, message: `Optimisation indisponible – ${reasons}` };
  });
