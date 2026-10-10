import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAILS } from "@/lib/owners";
import { kieCreditsToSamCredits } from "@/lib/ai-pricing";

/**
 * Modèles autorisés. Pour Claude, copie le champ "model" depuis
 * GET https://api.kie.ai/anthropic/v1/models (ou la page Kie.ai du modèle).
 */
export const CHAT_MODELS = {
  gpt: [{ id: "gpt-6-astra", label: "GPT 6 Astra" }],
  // Identifiants confirmés dans la documentation Kie.ai.
  // À ajouter ensuite : Opus 4.8, Haiku 5.5, Fable 5 (leurs identifiants sont à confirmer).
  // Identifiants confirmés dans la documentation Kie.ai (valeur de l'enum "model").
  // À ajouter ensuite : Fable 5 (identifiant à confirmer).
  claude: [
    { id: "claude-opus-4-8", label: "Opus 4.8" },
    { id: "claude-sonnet-5-5", label: "Sonnet 5.5" },
    { id: "claude-haiku-5-5", label: "Haiku 5.5" },
    { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
    { id: "claude-haiku-4-5", label: "Haiku 4.5" },
  ],
} as const;

const KIE_KEY = () => process.env.KIE_API_KEY ?? "";

type Msg = { role: "user" | "assistant"; content: string };

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
        messages: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(8000) }))
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
    if (!KIE_KEY()) return { ok: false as const, message: "Clé Kie.ai manquante côté serveur." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credits_balance")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile || Number(profile.credits_balance) < 1) {
      return { ok: false as const, message: "Crédits insuffisants." };
    }

    const messages: Msg[] = data.messages;
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
              content: [{ type: m.role === "assistant" ? "output_text" : "input_text", text: m.content }],
            })),
          }),
        });
        const json = await res.json();
        if (!res.ok || (json.code && json.code !== 200)) {
          return { ok: false as const, message: `Kie.ai : ${json.msg ?? "erreur"}` };
        }
        text = (json.output ?? [])
          .filter((o: { type: string }) => o.type === "message")
          .flatMap((o: { content: { type: string; text: string }[] }) => o.content)
          .filter((c: { type: string }) => c.type === "output_text")
          .map((c: { text: string }) => c.text)
          .join("");
        kieCredits = Number(json.credits_consumed ?? 0);
      } else {
        // Endpoint Claude de Kie.ai (documentation de chaque modèle).
        const res = await fetch("https://api.kie.ai/claude/v1/messages", {
          method: "POST",
          headers,
          body: JSON.stringify({ model: data.model, messages, stream: false, max_tokens: 4096 }),
        });
        const json = await res.json();
        if (!res.ok || (json.code && json.code !== 200)) {
          return { ok: false as const, message: `Kie.ai : ${json.msg ?? json.error?.message ?? "erreur"}` };
        }
        text = (json.content ?? [])
          .filter((c: { type: string }) => c.type === "text")
          .map((c: { text: string }) => c.text)
          .join("");
        kieCredits = Number(json.credits_consumed ?? 0);
      }
    } catch {
      return { ok: false as const, message: "Connexion à Kie.ai impossible." };
    }

    if (!text) return { ok: false as const, message: "Réponse vide de Kie.ai." };

    const cost = kieCreditsToSamCredits(kieCredits);
    const { data: debited, error } = await supabaseAdmin.rpc("debit_ai_credits", {
      p_user: context.userId,
      p_cost: cost,
      p_ref: `ai-${data.provider}-${data.model}`,
    });
    if (error || debited !== true) {
      return { ok: false as const, message: "Crédits insuffisants." };
    }

    return {
      ok: true as const,
      text,
      kieCredits,
      cost: Math.round(cost * 1000) / 1000,
    };
  });
