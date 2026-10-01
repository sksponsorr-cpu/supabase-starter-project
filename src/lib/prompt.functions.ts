import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type EnhanceInput = {
  prompt: string;
  mediaType: "image" | "video";
  language?: string;
};

const SYSTEM = `Tu es un directeur artistique expert en prompts pour la génération vidéo/image par IA (Grok Imagine).
Transforme l'idée simple de l'utilisateur en UN SEUL prompt riche, cinématographique et prêt à l'emploi.
Le prompt doit décrire, en prose fluide et dense (80 à 140 mots) :
- les détails visuels de la scène (sujet, décor, textures, palette, style) ;
- le mouvement de caméra (travelling, plan drone, ralenti, focale, profondeur de champ) ;
- l'éclairage et l'ambiance (heure dorée, néons, contre-jour, brume, contraste) ;
- pour la vidéo : une section audio explicite décrivant les effets sonores et l'ambiance
  (ex. rugissement de moteur, pluie sur le métal, basses cinématographiques, souffle du vent).
Règles : réponds UNIQUEMENT par le prompt final, sans guillemets, sans titre, sans liste à puces,
sans commentaire ni explication. Écris dans la langue de l'utilisateur.`;

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
  .handler(async ({ data }) => {
    // Utilise XAI_API_KEY (même clé que pour la génération image/vidéo dans xai.server.ts).
    // Modèle texte : grok-3-mini par défaut (tâche de reformulation courte, pas de génération média).
    // Surchargeable via XAI_CHAT_MODEL si besoin d'un modèle plus puissant.
    const apiKey = process.env["XAI_API_KEY"];
    if (!apiKey) return { ok: false as const, message: "Optimisation indisponible" };

    const baseUrl = (process.env["XAI_BASE_URL"] ?? "https://api.x.ai/v1").replace(/\/+$/, "");
    const model = process.env["XAI_CHAT_MODEL"] ?? "grok-3-mini";

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM },
            {
              role: "user",
              content: `Type de média : ${data.mediaType === "video" ? "vidéo" : "image"}. Langue de réponse : ${data.language}.\nIdée : ${data.prompt}`,
            },
          ],
        }),
      });
    } catch (error) {
      console.error("[enhancePrompt] Network error:", error);
      return { ok: false as const, message: "Optimisation impossible (erreur réseau)" };
    }

    if (!res.ok) {
      // [DIAG] Lire le corps brut pour exposer la vraie erreur xAI
      const errBody = await res.text().catch(() => "(corps illisible)");
      console.error(`[enhancePrompt] xAI HTTP ${res.status} — body:`, errBody);
      if (res.status === 429) return { ok: false as const, message: "Trop de requêtes, réessayez" };
      if (res.status === 402) return { ok: false as const, message: "Crédits IA épuisés" };
      // Message de diagnostic temporaire : expose le statut + début du corps
      return { ok: false as const, message: `[DIAG] xAI ${res.status}: ${errBody.slice(0, 200)}` };
    }

    const rawText = await res.text().catch(() => "");
    console.log("[enhancePrompt] xAI raw response:", rawText.slice(0, 500));
    let json: { choices?: { message?: { content?: string } }[] } = {};
    try { json = JSON.parse(rawText) as typeof json; } catch { /* ignore */ }

    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) {
      // [DIAG] Expose la structure JSON brute si choices est vide/absent
      console.error("[enhancePrompt] Empty/unexpected response:", rawText.slice(0, 500));
      return { ok: false as const, message: `[DIAG] Réponse inattendue: ${rawText.slice(0, 200)}` };
    }
    return { ok: true as const, prompt: text.replace(/^["'«»\s]+|["'«»\s]+$/g, "") };
  });
