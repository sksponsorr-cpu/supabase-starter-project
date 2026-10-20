import { CREATOR_MODELS } from "@/lib/creator-models";

type Json = Record<string, unknown>;
export type McpTool = {
  name: string;
  description: string;
  inputSchema: Json;
  run: (userId: string, args: Json) => Promise<unknown>;
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

const OFFERS_URL = "https://sam-flash.lat/app";

/** Coût en crédits Sam Flash, même barème que la barre de saisie. */
export async function estimateCost(input: { mediaType: "image" | "video"; model?: string | null; seconds?: number; resolution?: string }): Promise<number> {
  const { samCreditsFor, isPricedModel } = await import("@/lib/creator-pricing");
  if (input.mediaType === "video" && input.model && isPricedModel(input.model)) {
    const res = input.resolution === "1080p" || input.resolution === "480p" ? input.resolution : "720p";
    const c = samCreditsFor(input.model, res, input.seconds ?? 5);
    if (c !== null) return c;
  }
  const { creditCostFor } = await import("@/lib/credits");
  const { getCreditConfig } = await import("@/lib/credits.server");
  const config = await getCreditConfig();
  return creditCostFor(input.mediaType, input.seconds ?? 5, input.resolution ?? "720p", config);
}

async function balanceOf(userId: string): Promise<number> {
  const { data } = await (await db()).from("profiles").select("credits_balance").eq("id", userId).maybeSingle();
  return data?.credits_balance ?? 0;
}

/** Vérifie le solde avant de lancer. Renvoie un message clair pour Claude si le solde est insuffisant. */
async function launch(userId: string, input: Record<string, unknown>, cost: number) {
  const balance = await balanceOf(userId);
  if (balance < cost) {
    return {
      status: "insufficient_credits",
      message: `Cette génération coûte ${cost} crédits, et tu en as ${balance}. Il te manque ${cost - balance} crédits. Tu peux recharger ton compte ici : ${OFFERS_URL} (bouton « Voir les offres »).`,
      cost_credits: cost,
      balance_credits: balance,
      missing_credits: cost - balance,
      offers_url: OFFERS_URL,
    };
  }
  const { runGeneration } = await import("@/lib/services/generation.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await runGeneration(userId, input as never);
  const { bytes: _bytes, ...rest } = result ?? {};
  if (rest.ok === false) {
    return { status: "failed", message: rest.message ?? "La génération n'a pas pu démarrer. Tes crédits ne sont pas décomptés.", cost_credits: cost };
  }
  return { status: "started", cost_credits: cost, ...rest };
}

export const MCP_TOOLS: McpTool[] = [
  {
    name: "get_balance",
    description: "Solde de crédits Sam Flash de l'utilisateur.",
    inputSchema: { type: "object", properties: {} },
    run: async (userId) => {
      const { data } = await (await db()).from("profiles").select("credits_balance").eq("id", userId).maybeSingle();
      return { credits: data?.credits_balance ?? 0 };
    },
  },
  {
    name: "list_models",
    description: "Modèles vidéo disponibles, avec leurs durées, résolutions et modes.",
    inputSchema: { type: "object", properties: {} },
    run: async () =>
      CREATOR_MODELS.filter((m) => m.live).map((m) => ({
        id: m.id,
        label: m.label,
        durations_seconds: m.durations,
        resolutions: m.resolutions,
        modes: m.modes,
      })),
  },
  {
    name: "estimate_cost",
    description: "Coût en crédits d'une génération, avant de la lancer. À appeler avant generate_image ou generate_video pour annoncer le prix.",
    inputSchema: {
      type: "object",
      properties: {
        media_type: { type: "string", enum: ["image", "video"] },
        model: { type: "string", description: "Identifiant du modèle vidéo (voir list_models)." },
        duration_seconds: { type: "number" },
        resolution: { type: "string", enum: ["480p", "720p", "1080p"] },
      },
      required: ["media_type"],
    },
    run: async (userId, args) => {
      const mediaType = args.media_type === "image" ? "image" : "video";
      const seconds = num(args.duration_seconds, 5);
      const cost = await estimateCost({
        mediaType,
        model: typeof args.model === "string" ? args.model : null,
        seconds,
        resolution: str(args.resolution, 8) || "720p",
      });
      return { cost_credits: cost, balance_credits: await balanceOf(userId), media_type: mediaType };
    },
  },
  {
    name: "list_creations",
    description: "Dernières créations de l'utilisateur (plus récentes d'abord).",
    inputSchema: { type: "object", properties: { limit: { type: "number", minimum: 1, maximum: 50 } } },
    run: async (userId, args) => {
      const limit = Math.min(50, Math.max(1, num(args.limit, 10)));
      const { data } = await (await db())
        .from("generations")
        .select("id, prompt, media_type, status, media_url, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      return data ?? [];
    },
  },
  {
    name: "get_creation",
    description: "Statut et lien d'une création, par son identifiant.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    run: async (userId, args) => {
      const id = str(args.id, 64);
      const { data } = await (await db())
        .from("generations")
        .select("id, prompt, media_type, status, media_url, error_message, created_at")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      return data ?? { error: "Création introuvable." };
    },
  },
  {
    name: "generate_image",
    description: "Génère une image à partir d'un texte, éventuellement avec une photo de départ. Débite les crédits.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", maxLength: 2000 },
        aspect_ratio: { type: "string", enum: ["9:16", "2:3", "3:4", "1:1", "16:9"] },
        image_url: { type: "string", description: "Lien public d'une photo de départ (facultatif)." },
      },
      required: ["prompt"],
    },
    run: async (userId, args) => {
      const prompt = str(args.prompt, 2000);
      if (!prompt) return { error: "Le texte (prompt) est obligatoire." };
      const img = str(args.image_url, 2000) || null;
      const cost = await estimateCost({ mediaType: "image" });
      return launch(userId, {
        prompt,
        mediaType: "image",
        resolution: "720p",
        duration: "",
        aspectRatio: str(args.aspect_ratio, 8) || "9:16",
        imageUrl: img,
        imageUrls: img ? [img] : [],
        creatorMode: null,
        model: null,
        project_id: null,
      }, cost);
    },
  },
  {
    name: "generate_video",
    description: "Génère une vidéo avec un modèle Sam Flash (voir list_models). Débite les crédits selon le modèle, la durée et la résolution.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", maxLength: 2000 },
        model: { type: "string", enum: CREATOR_MODELS.filter((m) => m.live).map((m) => m.id) },
        duration_seconds: { type: "number" },
        resolution: { type: "string", enum: ["480p", "720p", "1080p"] },
        aspect_ratio: { type: "string", enum: ["9:16", "2:3", "3:4", "1:1", "16:9"] },
        image_url: { type: "string", description: "Lien public d'une photo de départ (facultatif)." },
      },
      required: ["prompt", "model"],
    },
    run: async (userId, args) => {
      const prompt = str(args.prompt, 2000);
      const model = CREATOR_MODELS.find((m) => m.id === args.model && m.live);
      if (!prompt) return { error: "Le texte (prompt) est obligatoire." };
      if (!model) return { error: "Modèle inconnu. Utilise list_models." };
      const seconds = num(args.duration_seconds, model.durations[0]);
      if (!model.durations.includes(seconds)) {
        return { error: `Durée non prise en charge par ${model.label}. Choix : ${model.durations.join(", ")} s.` };
      }
      const img = str(args.image_url, 2000) || null;
      const cost = await estimateCost({ mediaType: "video", model: model.id, seconds, resolution: str(args.resolution, 8) || "720p" });
      return launch(userId, {
        prompt,
        mediaType: "video",
        model: model.id,
        resolution: str(args.resolution, 8) || "720p",
        duration: `${seconds}s`,
        aspectRatio: str(args.aspect_ratio, 8) || "9:16",
        imageUrl: img,
        imageUrls: img ? [img] : [],
        creatorMode: img ? "image" : "text",
        project_id: null,
      }, cost);
    },
  },
];
