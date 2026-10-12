import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAILS } from "@/lib/owners";
import { kieCreditsToSamCredits } from "@/lib/ai-pricing";
import { VIDEO_ASSISTANT_INSTRUCTIONS } from "@/lib/assistant/claude-instructions";
import { createOmniTask, getOmniTask } from "@/lib/services/omni.server";
import { omniSegmentCredits } from "@/lib/omni-pricing";

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

// Les deux fournisseurs reçoivent au maximum quatre images échantillonnées par message.
const MAX_IMAGES_PER_MESSAGE = 4;

/** Message affiché à l'utilisateur : jamais de détail technique. */
const GENERIC_ERROR = "Le service est momentanément indisponible. Réessayez dans un instant.";

const CODE_PREFIX =
  "Tu es un assistant de programmation expert. Réponds en français, donne du code complet et fonctionnel dans des blocs de code, puis explique brièvement les changements.\n\n";

type ImagePart = { mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string };
type VideoPart = { name: string; mediaType: string; data?: string; url?: string };
type Msg = { role: "user" | "assistant"; content: string; images?: ImagePart[]; videos?: VideoPart[] };

/** Envoie le fichier vidéo original au stockage temporaire KIE pour transmettre une URL au modèle. */
async function uploadKieVideo(video: VideoPart): Promise<string> {
  if (!video.data) throw new Error("Vidéo sans données");
  const binary = atob(video.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: video.mediaType || "video/mp4" }), video.name || "video.mp4");
  form.append("uploadPath", "sam-flash-chat-videos");
  form.append("fileName", video.name || "video.mp4");
  const res = await fetch("https://kieai.redpandaai.co/api/file-stream-upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${KIE_KEY()}` },
    body: form,
  });
  const responseText = await res.text();
  let json: any = {};
  try { json = responseText ? JSON.parse(responseText) : {}; } catch { json = { message: responseText.slice(0, 300) }; }
  const url = json?.data?.downloadUrl ?? json?.downloadUrl ?? json?.data?.url;
  if (!res.ok || typeof url !== "string" || !url.startsWith("http")) {
    const detail = String(json?.message ?? json?.msg ?? json?.error ?? `HTTP ${res.status}`).slice(0, 250);
    console.error("[chat-ia] KIE vidéo upload échoué", res.status, JSON.stringify(json).slice(0, 500));
    throw new Error(`KIE_VIDEO_UPLOAD: ${detail}`);
  }
  return url;
}

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

/** Outils que Claude peut appeler en mode vidéo (génération Omni via KIE). */
const OMNI_TOOLS = [
  {
    name: "generer_segment_omni",
    description:
      "Génère un segment vidéo de 4, 6, 8 ou 10 secondes avec Omni. Débite les crédits du segment. Renvoie le lien du segment ou un identifiant de tâche si la génération prend du temps.",
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Prompt détaillé du segment, sans voix off ni musique." },
        duree: { type: "integer", enum: [4, 6, 8, 10] },
        resolution: { type: "string", enum: ["360p", "720p"] },
        format: { type: "string", enum: ["16:9", "9:16"] },
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
];

type ToolOutcome = { content: string; isError: boolean };

/** Exécute un outil demandé par Claude. Les vérifications de solde sont faites ici, côté serveur. */
async function runOmniTool(
  name: string,
  input: Record<string, unknown>,
  ctx: { db: any; userId: string },
): Promise<ToolOutcome> {
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

  // Règle d'arrêt : on ne lance jamais un segment que le solde ne couvre pas.
  const { data: profile } = await ctx.db
    .from("profiles")
    .select("credits_balance")
    .eq("id", ctx.userId)
    .maybeSingle();
  const balance = Number(profile?.credits_balance ?? 0);
  if (balance < cost) {
    return {
      content: `Solde insuffisant : ce segment coûte ${cost} crédits et le compte en a ${balance}. Arrêtez la génération, envoyez les segments déjà terminés et indiquez le nombre de crédits manquants.`,
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
  if (debited !== true) {
    return { content: "Crédits insuffisants pour lancer ce segment.", isError: true };
  }

  // Attente bornée : au-delà, Claude reçoit l'identifiant et peut vérifier plus tard.
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 6000));
    const st = await getOmniTask(created.taskId);
    if (st.state === "success") return { content: `Segment prêt (${cost} crédits) : ${st.resultUrl}`, isError: false };
    if (st.state === "fail") return { content: `Échec du segment : ${st.failMsg}. Les ${cost} crédits de ce segment ont été débités.`, isError: false };
    if (st.state === "error") return { content: st.message, isError: true };
  }
  return {
    content: `Segment en cours (taskId ${created.taskId}, ${cost} crédits débités). Appelez verifier_segment_omni pour obtenir le résultat.`,
    isError: false,
  };
}

/** Appels Claude via KIE, avec outils en mode vidéo. Renvoie le texte final et le coût KIE cumulé. */
async function runClaude(args: {
  url: string;
  headers: Record<string, string>;
  model: string;
  messages: Msg[];
  videoMode: boolean;
  ctx: { db: any; userId: string };
}): Promise<{ ok: true; text: string; kieCredits: number } | { ok: false; message: string }> {
  const convo: unknown[] = args.messages.map((m) => {
    const content: unknown[] = [
      ...(m.images ?? []).map((img) => ({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.data },
      })),
      ...(m.videos ?? []).filter((v) => v.url).map((v) => ({
        // Tentative directe : si le modèle/KIE ne prend pas ce bloc en charge,
        // l'API renverra explicitement une erreur au lieu de substituer des images.
        type: "video",
        source: { type: "url", url: v.url },
      })),
      { type: "text", text: m.content },
    ];
    return (m.images?.length || m.videos?.length) ? { role: m.role, content } : { role: m.role, content: m.content };
  });

  let text = "";
  let kieCredits = 0;
  const maxTurns = args.videoMode ? 4 : 1;

  for (let turn = 0; turn < maxTurns; turn++) {
    const body: Record<string, unknown> = {
      model: args.model,
      stream: false,
      max_tokens: 4096,
      messages: convo,
    };
    if (args.videoMode) {
      body.system = VIDEO_ASSISTANT_INSTRUCTIONS;
      body.tools = OMNI_TOOLS;
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
      const outcome = await runOmniTool(b.name ?? "", b.input ?? {}, args.ctx);
      results.push({ type: "tool_result", tool_use_id: b.id, content: outcome.content, is_error: outcome.isError });
    }
    convo.push({ role: "user", content: results });
  }
  return { ok: true, text, kieCredits };
}

/** Même outils, au format « function » de l'API Responses (utilisée par GPT 6 Astra). */
const OMNI_FUNCTION_TOOLS = OMNI_TOOLS.map((t) => ({
  type: "function",
  name: t.name,
  description: t.description,
  parameters: t.input_schema,
}));

/** Appels GPT 6 Astra via KIE (format Responses), avec outils Omni en mode vidéo. */
async function runGpt(args: {
  url: string;
  headers: Record<string, string>;
  model: string;
  messages: Msg[];
  videoMode: boolean;
  ctx: { db: any; userId: string };
}): Promise<{ ok: true; text: string; kieCredits: number } | { ok: false; message: string }> {
  const convo: unknown[] = args.messages.map((m) => ({
    role: m.role,
    content: [
      ...(m.images ?? []).map((img) => ({
        type: "input_image",
        image_url: `data:${img.mediaType};base64,${img.data}`,
      })),
      ...(m.videos ?? []).filter((v) => v.url).map((v) => ({
        // Envoi du fichier original à l'API Responses pour tester la prise en charge du fichier vidéo.
        type: "input_file",
        file_url: v.url,
        filename: v.name,
      })),
      { type: m.role === "assistant" ? "output_text" : "input_text", text: m.content },
    ],
  }));

  let text = "";
  let kieCredits = 0;
  const maxTurns = args.videoMode ? 4 : 1;

  for (let turn = 0; turn < maxTurns; turn++) {
    const body: Record<string, unknown> = { model: args.model, stream: false, input: convo };
    if (args.videoMode) {
      body.instructions = VIDEO_ASSISTANT_INSTRUCTIONS;
      body.tools = OMNI_FUNCTION_TOOLS;
    }
    const res = await fetch(args.url, { method: "POST", headers: args.headers, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok || (json.code && json.code !== 200)) {
      console.error("[chat-ia] Kie GPT", res.status, JSON.stringify(json).slice(0, 500));
      return { ok: false, message: GENERIC_ERROR };
    }
    kieCredits += Number(json.credits_consumed ?? 0);
    const output: { type: string; content?: { type: string; text: string }[]; name?: string; arguments?: string; call_id?: string }[] =
      json.output ?? [];
    text += output
      .filter((o) => o.type === "message")
      .flatMap((o) => o.content ?? [])
      .filter((c) => c.type === "output_text")
      .map((c) => c.text)
      .join("");

    const calls = output.filter((o) => o.type === "function_call");
    if (!args.videoMode || calls.length === 0) return { ok: true, text, kieCredits };

    // Reprend les éléments de sortie tels quels, puis ajoute le résultat de chaque outil.
    convo.push(...output);
    for (const c of calls) {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(c.arguments || "{}");
      } catch {
        input = {};
      }
      const outcome = await runOmniTool(c.name ?? "", input, args.ctx);
      convo.push({ type: "function_call_output", call_id: c.call_id, output: outcome.content });
    }
  }
  return { ok: true, text, kieCredits };
}

export const sendChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        provider: z.enum(["claude", "gpt"]),
        model: z.string().min(1).max(60),
        mode: z.enum(["chat", "code", "video"]).default("chat"),
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
                .max(MAX_IMAGES_PER_MESSAGE)
                .optional(),
              videos: z.array(z.object({
                name: z.string().min(1).max(255),
                mediaType: z.enum(["video/mp4", "video/webm", "video/quicktime", "video/mpeg", "video/3gpp", "video/x-matroska", "application/octet-stream"]),
                data: z.string().min(1).max(4_300_000),
              })).max(1).optional(),
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
    let messages: Msg[] = data.messages.map((m, i) =>
      data.mode === "code" && i === 0 && m.role === "user" ? { ...m, content: CODE_PREFIX + m.content } : m,
    );
    try {
      messages = await Promise.all(messages.map(async (m) => {
        if (!m.videos?.length) return m;
        const videos = await Promise.all(m.videos.map(async (video) => ({
          name: video.name,
          mediaType: video.mediaType,
          url: await uploadKieVideo(video),
        })));
        return { ...m, videos };
      }));
    } catch (error) {
      console.error("[chat-ia] envoi vidéo KIE impossible", error);
      const detail = error instanceof Error ? error.message : "Erreur inconnue";
      if (detail.includes("KIE_VIDEO_UPLOAD:")) {
        return { ok: false as const, message: `KIE a refusé la vidéo : ${detail.replace("KIE_VIDEO_UPLOAD: ", "")}` };
      }
      return { ok: false as const, message: "L’envoi de la vidéo a échoué. Utilisez un fichier MP4 de 3 Mo maximum et réessayez." };
    }

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
