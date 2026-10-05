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

/** 1) fal.ai (utilise FAL_KEY, déjà configurée pour les vidéos) */
async function viaFal(d: { prompt: string; mediaType: string; language: string }): Promise<EnhanceResult> {
  const key = process.env["FAL_KEY"];
  if (!key) return { ok: false, message: "fal non configuré" };
  try {
    const res = await fetch("https://fal.run/fal-ai/any-llm", {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, system_prompt: SYSTEM, prompt: userMessage(d) }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error("[enhancePrompt] fal HTTP", res.status, body.slice(0, 300));
      return { ok: false, message: "fal indisponible" };
    }
    const json = JSON.parse(body) as { output?: string };
    const text = json.output ? clean(json.output) : "";
    return text ? { ok: true, prompt: text } : { ok: false, message: "fal réponse vide" };
  } catch (e) {
    console.error("[enhancePrompt] fal error", e);
    return { ok: false, message: "fal erreur" };
  }
}

/** 2) Gemini directement chez Google (utilise GEMINI_API_KEY) */
async function viaGemini(d: { prompt: string; mediaType: string; language: string }): Promise<EnhanceResult> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) return { ok: false, message: "Gemini non configuré" };
  const model = process.env["GEMINI_MODEL"] ?? "gemini-2.5-flash";
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
      console.error("[enhancePrompt] Gemini HTTP", res.status, body.slice(0, 300));
      return { ok: false, message: "Gemini indisponible" };
    }
    const json = JSON.parse(body) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const raw = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const text = clean(raw);
    return text ? { ok: true, prompt: text } : { ok: false, message: "Gemini réponse vide" };
  } catch (e) {
    console.error("[enhancePrompt] Gemini error", e);
    return { ok: false, message: "Gemini erreur" };
  }
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

    if (process.env["XAI_API_KEY"]) {
      const { enhancePromptWithXai } = await import("@/lib/services/xai.server");
      return enhancePromptWithXai(data);
    }
    return { ok: false, message: "Optimisation indisponible pour le moment" };
  });
