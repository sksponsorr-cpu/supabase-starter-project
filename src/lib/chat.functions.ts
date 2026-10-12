import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAILS } from "@/lib/owners";
import { kieCreditsToSamCredits } from "@/lib/ai-pricing";
import { analyzeVideoUrl } from "@/lib/services/gemini.server";
import { VIDEO_SYSTEM } from "@/lib/assistant/claude-instructions";
import { createOmniTask, getOmniTask } from "@/lib/services/omni.server";
import { omniSegmentCredits } from "@/lib/omni-pricing";
import { isR2Configured, presignPutUrl, publicUrlFor, uploadToR2 } from "@/lib/services/r2.server";

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

/** Outil mis à disposition de Claude en mode vidéo : analyse d'une vidéo via Gemini (KIE). */
const VIDEO_TOOLS = [
  {
    name: "generer_segment_omni",
    description:
      "Lance la génération d'un segment vidéo avec Omni (4, 6, 8 ou 10 secondes, 360p ou 720p, 16:9 ou 9:16). Vérifie le solde et débite les crédits du segment. À appeler seulement après avoir présenté le plan et annoncé le coût, et après accord de l'utilisateur.",
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Prompt détaillé du segment (sujet, action, caméra, lumière, environnement, transition)." },
        duree: { type: "integer", enum: [4, 6, 8, 10] },
        resolution: { type: "string", enum: ["360p", "720p"] },
        format: { type: "string", enum: ["16:9", "9:16"] },
        voix_off: { type: "boolean", description: "true seulement si l'utilisateur a demandé une voix off ou une musique." },
      },
      required: ["prompt", "duree", "resolution", "format"],
    },
  },
  {
    name: "verifier_segment_omni",
    description: "Vérifie l'avancement d'un segment lancé avec generer_segment_omni, à partir de son identifiant.",
    input_schema: {
      type: "object",
      properties: { taskId: { type: "string" } },
      required: ["taskId"],
    },
  },
  {
    name: "analyser_video",
    description:
      "Analyse la vidéo fournie par l'utilisateur (son style, son rythme, ses transitions, sa composition) et renvoie une description détaillée. À utiliser avant d'écrire les prompts de génération.",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string", description: "Ce qu'il faut observer ou décrire dans la vidéo." },
      },
      required: ["question"],
    },
  },
];



type OmniOutcome = { content: string; isError: boolean };

/** Exécute generer_segment_omni / verifier_segment_omni. Le solde est contrôlé ici, côté serveur. */
async function runOmniTool(
  name: string,
  input: Record<string, unknown>,
  ctx: { db: any; userId: string },
): Promise<OmniOutcome> {
  if (name === "verifier_segment_omni") {
    const taskId = typeof input.taskId === "string" ? input.taskId.slice(0, 100) : "";
    if (!taskId) return { content: "Identifiant de tâche manquant.", isError: true };
    const st = await getOmniTask(taskId);
    if (st.state === "success") return { content: `Segment prêt : ${st.resultUrl}`, isError: false };
    if (st.state === "fail") return { content: `Échec du segment : ${st.failMsg}`, isError: false };
    if (st.state === "waiting") return { content: `Segment encore en cours (${taskId}). Revérifiez plus tard.`, isError: false };
    return { content: st.message, isError: true };
  }

  if (name !== "generer_segment_omni") return { content: "Outil inconnu.", isError: true };

  const duree = Number(input.duree);
  let cost: number;
  try {
    cost = omniSegmentCredits(duree);
  } catch {
    return { content: "Durée invalide : 4, 6, 8 ou 10 secondes.", isError: true };
  }

  const { data: profile } = await ctx.db.from("profiles").select("credits_balance").eq("id", ctx.userId).maybeSingle();
  const balance = Number(profile?.credits_balance ?? 0);
  if (balance < cost) {
    return {
      content: `Solde insuffisant : ce segment coûte ${cost} crédits et le compte en a ${balance}. Arrêtez la génération, remettez les segments déjà terminés et indiquez les crédits manquants.`,
      isError: true,
    };
  }

  const created = await createOmniTask({
    prompt: String(input.prompt ?? ""),
    durationSec: duree as 4 | 6 | 8 | 10,
    resolution: (input.resolution === "720p" ? "720p" : "360p") as "360p" | "720p",
    aspectRatio: (input.format === "9:16" ? "9:16" : "16:9") as "16:9" | "9:16",
  });
  if (!created.ok) return { content: created.message, isError: true };

  const { data: debited } = await ctx.db.rpc("debit_ai_credits", {
    p_user: ctx.userId,
    p_cost: cost,
    p_ref: `omni-${created.taskId}`,
  });
  if (debited !== true) return { content: "Crédits insuffisants pour lancer ce segment.", isError: true };

  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 6000));
    const st = await getOmniTask(created.taskId);
    if (st.state === "success") return { content: `Segment prêt (${cost} crédits) : ${st.resultUrl}`, isError: false };
    if (st.state === "fail") return { content: `Échec du segment : ${st.failMsg}. Les ${cost} crédits ont été débités.`, isError: false };
    if (st.state === "error") return { content: st.message, isError: true };
  }
  return {
    content: `Segment en cours (taskId ${created.taskId}, ${cost} crédits débités). Appelez verifier_segment_omni pour obtenir le résultat.`,
    isError: false,
  };
}

/** Appel Claude via KIE. En mode vidéo, Claude peut appeler analyser_video (Gemini). */
async function runClaude(args: {
  url: string;
  headers: Record<string, string>;
  model: string;
  messages: Msg[];
  videoMode?: boolean;
  videoUrl?: string;
  ctx?: { db: any; userId: string };
}): Promise<{ ok: true; text: string; kieCredits: number } | { ok: false; message: string }> {
  const convo: unknown[] = args.messages.map((m) =>
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
  );

  let text = "";
  let kieCredits = 0;
  const useTools = Boolean(args.videoMode);
  const maxTurns = useTools ? 6 : 1;

  for (let turn = 0; turn < maxTurns; turn++) {
    const body: Record<string, unknown> = { model: args.model, stream: false, max_tokens: 4096, messages: convo };
    if (useTools) {
      body.system = VIDEO_SYSTEM;
      body.tools = VIDEO_TOOLS;
    }
    const res = await fetch(args.url, { method: "POST", headers: args.headers, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok || (json.code && json.code !== 200)) {
      console.error("[chat-ia] Kie Claude", res.status, JSON.stringify(json).slice(0, 500));
      return { ok: false, message: GENERIC_ERROR };
    }
    kieCredits += Number(json.credits_consumed ?? 0);
    const blocks: { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }[] =
      json.content ?? [];
    text += blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");

    if (json.stop_reason !== "tool_use") return { ok: true, text, kieCredits };

    convo.push({ role: "assistant", content: blocks });
    const results = [];
    for (const b of blocks.filter((b) => b.type === "tool_use")) {
      if (b.name === "generer_segment_omni" || b.name === "verifier_segment_omni") {
        const outcome = args.ctx
          ? await runOmniTool(b.name, b.input ?? {}, args.ctx)
          : { content: "Génération indisponible.", isError: true };
        results.push({ type: "tool_result", tool_use_id: b.id, content: outcome.content, is_error: outcome.isError });
      } else if (b.name === "analyser_video" && args.videoUrl) {
        const question = String(b.input?.question ?? "Décris le style de cette vidéo.");
        const analysis = await analyzeVideoUrl({ videoUrl: args.videoUrl, prompt: question });
        results.push({
          type: "tool_result",
          tool_use_id: b.id,
          content: analysis.ok ? analysis.text : analysis.message,
          is_error: !analysis.ok,
        });
      } else {
        results.push({ type: "tool_result", tool_use_id: b.id, content: "Outil inconnu.", is_error: true });
      }
    }
    convo.push({ role: "user", content: results });
  }
  return { ok: true, text, kieCredits };
}

/** Appel GPT 6 Astra via KIE (format Responses) : texte et images uniquement. */
async function runGpt(args: {
  url: string;
  headers: Record<string, string>;
  model: string;
  messages: Msg[];
  videoMode?: boolean;
  ctx?: { db: any; userId: string };
}): Promise<{ ok: true; text: string; kieCredits: number } | { ok: false; message: string }> {
  const input = args.messages.map((m) => ({
    role: m.role,
    content: [
      ...(m.images ?? []).map((img) => ({
        type: "input_image",
        image_url: `data:${img.mediaType};base64,${img.data}`,
      })),
      { type: m.role === "assistant" ? "output_text" : "input_text", text: m.content },
    ],
  }));
  const res = await fetch(args.url, {
    method: "POST",
    headers: args.headers,
    body: JSON.stringify({ model: args.model, stream: false, input }),
  });
  const json = await res.json();
  if (!res.ok || (json.code && json.code !== 200)) {
    console.error("[chat-ia] Kie GPT", res.status, JSON.stringify(json).slice(0, 500));
    return { ok: false, message: GENERIC_ERROR };
  }
  const output: { type: string; content?: { type: string; text: string }[] }[] = json.output ?? [];
  const text = output
    .filter((o) => o.type === "message")
    .flatMap((o) => o.content ?? [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text)
    .join("");
  return { ok: true, text, kieCredits: Number(json.credits_consumed ?? 0) };
}


/** Reçoit une vidéo (base64, 3 Mo max) et la stocke à une adresse publique pour l'analyse. */
export const uploadChatVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        mimeType: z.enum(["video/mp4", "video/webm", "video/quicktime"]),
        data: z.string().min(1).max(4_200_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const claims = context.claims as { email?: unknown } | null;
    const email = typeof claims?.email === "string" ? claims.email.toLowerCase().trim() : "";
    if (!(email && OWNER_EMAILS.includes(email))) {
      const { data: isAdmin } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (isAdmin !== true) return { ok: false as const, message: "Accès réservé." };
    }
    if (!isR2Configured()) return { ok: false as const, message: "Stockage indisponible pour le moment." };
    const binary = atob(data.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    if (bytes.length > 3_000_000) return { ok: false as const, message: "Vidéo trop lourde (3 Mo maximum)." };
    const ext = data.mimeType === "video/webm" ? "webm" : data.mimeType === "video/quicktime" ? "mov" : "mp4";
    const key = `chat-videos/${context.userId}/${crypto.randomUUID()}.${ext}`;
    try {
      const url = await uploadToR2(key, bytes, data.mimeType);
      return { ok: true as const, url };
    } catch {
      return { ok: false as const, message: "Envoi de la vidéo impossible. Réessayez." };
    }
  });

/** Prépare l'envoi d'une vidéo (55 Mo max) : renvoie une URL signée pour l'envoyer directement vers R2. */
export const prepareChatVideoUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        mimeType: z.enum(["video/mp4", "video/webm", "video/quicktime"]),
        size: z.number().int().positive().max(55 * 1024 * 1024),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const claims = context.claims as { email?: unknown } | null;
    const email = typeof claims?.email === "string" ? claims.email.toLowerCase().trim() : "";
    if (!(email && OWNER_EMAILS.includes(email))) {
      const { data: isAdmin } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (isAdmin !== true) return { ok: false as const, message: "Accès réservé." };
    }
    if (!isR2Configured()) return { ok: false as const, message: "Stockage indisponible pour le moment." };
    const ext = data.mimeType === "video/webm" ? "webm" : data.mimeType === "video/quicktime" ? "mov" : "mp4";
    const key = `chat-videos/${context.userId}/${crypto.randomUUID()}.${ext}`;
    try {
      const uploadUrl = await presignPutUrl(key, 900);
      return { ok: true as const, uploadUrl, publicUrl: publicUrlFor(key) };
    } catch {
      return { ok: false as const, message: "Préparation de l'envoi impossible. Réessayez." };
    }
  });

export const sendChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        provider: z.enum(["claude", "gpt"]),
        model: z.string().min(1).max(60),
        mode: z.enum(["chat", "code", "video"]).default("chat"),
        videoUrl: z.string().url().max(2000).optional(),
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
                .max(8)
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
        const gpt = await runGpt({
          url: "https://api.kie.ai/codex/v1/responses",
          headers,
          model: data.model,
          messages,
          videoMode: data.mode === "video",
          ctx: { db: supabaseAdmin, userId: context.userId },
        });
        if (!gpt.ok) return { ok: false as const, message: gpt.message };
        text = gpt.text;
        kieCredits = gpt.kieCredits;
      } else {
        const claude = await runClaude({
          videoUrl: data.videoUrl,
          ctx: { db: supabaseAdmin, userId: context.userId },
          url: "https://api.kie.ai/claude/v1/messages",
          headers,
          model: data.model,
          messages,
          videoMode: data.mode === "video",
          ctx: { db: supabaseAdmin, userId: context.userId },
        });
        if (!claude.ok) return { ok: false as const, message: claude.message };
        text = claude.text;
        kieCredits = claude.kieCredits;
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
