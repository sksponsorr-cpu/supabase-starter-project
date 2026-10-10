import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAILS } from "@/lib/owners";
import { kieCreditsToSamCredits } from "@/lib/ai-pricing";

/** Identifiants confirmés dans la documentation Kie.ai (valeur de l'enum "model"). */
export const CHAT_MODELS = {
  gpt: [{ id: "gpt-6-astra", label: "GPT 6 Astra" }],
  claude: [
    { id: "claude-opus-4-8", label: "Opus 4.8" },
    { id: "claude-sonnet-5-5", label: "Sonnet 5.5" },
    { id: "claude-haiku-5-5", label: "Haiku 5.5" },
    { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
    { id: "claude-haiku-4-5", label: "Haiku 4.5" },
  ],
} as const;

const KIE_KEY = () => process.env.KIE_API_KEY ?? "";

/** Message affiché à l'utilisateur : jamais de détail technique. */
const GENERIC_ERROR = "Le service est momentanément indisponible. Réessayez dans un instant.";

const CODE_PREFIX =
  "Tu es un assistant de programmation expert. Réponds en français, donne du code complet et fonctionnel dans des blocs de code, puis explique brièvement les changements.\n\n";

type ImagePart = { mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string };
type Msg = { role: "user" | "assistant"; content: string; images?: ImagePart[] };

/** Vérifie si l'utilisateur est propriétaire ou administrateur. */
async function isAdminUser(context: {
  claims: unknown;
  supabase: { rpc: (f: string, a: object) => Promise<{ data: unknown }> };
  userId: string;
}): Promise<boolean> {
  const claims = context.claims as { email?: unknown } | null;
  const email = typeof claims?.email === "string" ? claims.email.toLowerCase().trim() : "";
  if (email && OWNER_EMAILS.includes(email)) return true;
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  return data === true;
}

/** Indique si la fonction IA est ouverte à cet utilisateur (test réservé à l'admin). */
export const aiAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return { enabled: await isAdminUser(context) };
  });

export const sendChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        provider: z.enum(["claude", "gpt"]),
        model: z.string().min(1).max(60),
        mode: z.enum(["chat", "code"]).default("chat"),
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().min(1).max(60000),
              images: z
                .array(
                  z.object({
                    mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
                    data: z.string().max(2_500_000),
                  }),
                )
                .max(4)
                .optional(),
            }),
          )
          .min(1)
          .max(30),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Fonction réservée aux tests : seuls le propriétaire et les administrateurs peuvent envoyer.
    if (!(await isAdminUser(context))) {
      return { ok: false as const, message: "Fonctionnalité non disponible." };
    }

    const allowed = CHAT_MODELS[data.provider].some((m) => m.id === data.model);
    if (!allowed) return { ok: false as const, message: "Modèle non disponible." };

    if (!KIE_KEY()) {
      console.error("[chat-ia] KIE_API_KEY manquante côté serveur");
      return { ok: false as const, message: GENERIC_ERROR };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credits_balance")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile || Number(profile.credits_balance) < 1) {
      return { ok: false as const, message: "Crédits insuffisants. Rechargez votre compte depuis Abonnement." };
    }

    // Mode Code : consigne ajoutée au premier message, sans toucher à l'affichage côté client.
    const messages: Msg[] = data.messages.map((m, i) =>
      data.mode === "code" && i === 0 && m.role === "user" ? { ...m, content: CODE_PREFIX + m.content } : m,
    );

    const headers = {
      Authorization: `Bearer ${KIE_KEY()}`,
      "Content-Type": "application/json",
    };
    let text = "";
    let kieCredits = 0;

    try {
      if (data.provider === "gpt") {
        const res = await fetch("https://api.kie.ai/codex/v1/responses", {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: data.model,
            stream: false,
            input: messages.map((m) => ({
              role: m.role,
              content: [
                ...(m.images ?? []).map((img) => ({
                  type: "input_image",
                  image_url: `data:${img.mediaType};base64,${img.data}`,
                })),
                { type: m.role === "assistant" ? "output_text" : "input_text", text: m.content },
              ],
            })),
          }),
        });
        const json = await res.json();
        if (!res.ok || (json.code && json.code !== 200)) {
          console.error("[chat-ia] Kie GPT", res.status, JSON.stringify(json).slice(0, 500));
          return { ok: false as const, message: GENERIC_ERROR };
        }
        text = (json.output ?? [])
          .filter((o: { type: string }) => o.type === "message")
          .flatMap((o: { content: { type: string; text: string }[] }) => o.content)
          .filter((c: { type: string }) => c.type === "output_text")
          .map((c: { text: string }) => c.text)
          .join("");
        kieCredits = Number(json.credits_consumed ?? 0);
      } else {
        const res = await fetch("https://api.kie.ai/claude/v1/messages", {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: data.model,
            stream: false,
            max_tokens: 4096,
            messages: messages.map((m) =>
              m.images && m.images.length > 0
                ? {
                    role: m.role,
                    content: [
                      ...m.images.map((img) => ({
                        type: "image",
                        source: { type: "base64", media_type: img.mediaType, data: img.data },
                      })),
                      { type: "text", text: m.content },
                    ],
                  }
                : { role: m.role, content: m.content },
            ),
          }),
        });
        const json = await res.json();
        if (!res.ok || (json.code && json.code !== 200)) {
          console.error("[chat-ia] Kie Claude", res.status, JSON.stringify(json).slice(0, 500));
          return { ok: false as const, message: GENERIC_ERROR };
        }
        text = (json.content ?? [])
          .filter((c: { type: string }) => c.type === "text")
          .map((c: { text: string }) => c.text)
          .join("");
        kieCredits = Number(json.credits_consumed ?? 0);
      }
    } catch (error) {
      console.error("[chat-ia] appel Kie impossible", error);
      return { ok: false as const, message: GENERIC_ERROR };
    }

    if (!text) {
      console.error("[chat-ia] réponse vide de Kie");
      return { ok: false as const, message: GENERIC_ERROR };
    }

    // Débit exact : coût réel converti en crédits Sam Flash, décimales conservées.
    const cost = kieCreditsToSamCredits(kieCredits);
    const { data: debited, error } = await supabaseAdmin.rpc("debit_ai_credits", {
      p_user: context.userId,
      p_cost: cost,
      p_ref: `ai-${data.provider}-${data.model}`,
    });
    if (error || debited !== true) {
      return { ok: false as const, message: "Crédits insuffisants. Rechargez votre compte depuis Abonnement." };
    }

    return { ok: true as const, text, cost: Math.round(cost * 1000) / 1000 };
  });
