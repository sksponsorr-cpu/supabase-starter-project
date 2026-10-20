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

type PostInput = { title?: unknown; prompt?: unknown; media_type?: unknown; model?: unknown; duration_seconds?: unknown };
const ALL_MODEL_IDS = CREATOR_MODELS.filter((m) => m.live).map((m) => m.id);

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
  {
    name: "search_creations",
    description: "Recherche dans les créations de l'utilisateur par mot-clé (dans le texte de la création).",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", maxLength: 100 }, limit: { type: "number", minimum: 1, maximum: 50 } },
      required: ["query"],
    },
    run: async (userId, args) => {
      const q = str(args.query, 100).replace(/[%_,]/g, " ");
      if (!q) return { error: "Mot-clé obligatoire." };
      const limit = Math.min(50, Math.max(1, num(args.limit, 10)));
      const { data } = await (await db())
        .from("generations")
        .select("id, prompt, media_type, status, media_url, created_at")
        .eq("user_id", userId)
        .ilike("prompt", `%${q}%`)
        .order("created_at", { ascending: false })
        .limit(limit);
      return data ?? [];
    },
  },
  {
    name: "regenerate_creation",
    description: "Refait une création existante avec un nouveau texte (même type de média). Débite les crédits.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Identifiant de la création d'origine." },
        new_prompt: { type: "string", maxLength: 2000, description: "Le texte de la nouvelle version." },
        model: { type: "string", description: "Modèle vidéo (voir list_models). Facultatif pour une vidéo." },
        duration_seconds: { type: "number" },
      },
      required: ["id", "new_prompt"],
    },
    run: async (userId, args) => {
      const { data: row } = await (await db())
        .from("generations")
        .select("id, media_type")
        .eq("id", str(args.id, 64))
        .eq("user_id", userId)
        .maybeSingle();
      if (!row) return { error: "Création introuvable." };
      const prompt = str(args.new_prompt, 2000);
      if (!prompt) return { error: "Le nouveau texte est obligatoire." };
      if (row.media_type === "image") {
        const cost = await estimateCost({ mediaType: "image" });
        return launch(userId, { prompt, mediaType: "image", resolution: "720p", duration: "", aspectRatio: "9:16", imageUrl: null, imageUrls: [], creatorMode: null, model: null, project_id: null }, cost);
      }
      const model = CREATOR_MODELS.find((m) => m.id === args.model && m.live) ?? CREATOR_MODELS.find((m) => m.id === "veo-3-1")!;
      const seconds = num(args.duration_seconds, model.durations[0]);
      if (!model.durations.includes(seconds)) return { error: `Durée non prise en charge par ${model.label} : ${model.durations.join(", ")} s.` };
      const cost = await estimateCost({ mediaType: "video", model: model.id, seconds, resolution: "720p" });
      return launch(userId, { prompt, mediaType: "video", model: model.id, resolution: "720p", duration: `${seconds}s`, aspectRatio: "9:16", imageUrl: null, imageUrls: [], creatorMode: "text", project_id: null }, cost);
    },
  },
  {
    name: "generate_variants",
    description: "Lance 2 ou 3 variantes d'une même idée pour comparer. Chaque variante débite ses crédits.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", maxLength: 2000 },
        count: { type: "number", minimum: 2, maximum: 3 },
        media_type: { type: "string", enum: ["image", "video"] },
        model: { type: "string" },
        duration_seconds: { type: "number" },
      },
      required: ["prompt"],
    },
    run: async (userId, args) => {
      const prompt = str(args.prompt, 2000);
      if (!prompt) return { error: "Le texte (prompt) est obligatoire." };
      const count = Math.min(3, Math.max(2, num(args.count, 2)));
      const results = [];
      for (let i = 0; i < count; i++) {
        const variantPrompt = `${prompt} (variante ${i + 1} sur ${count})`;
        if (args.media_type === "image") {
          const cost = await estimateCost({ mediaType: "image" });
          results.push(await launch(userId, { prompt: variantPrompt, mediaType: "image", resolution: "720p", duration: "", aspectRatio: "9:16", imageUrl: null, imageUrls: [], creatorMode: null, model: null, project_id: null }, cost));
        } else {
          const model = CREATOR_MODELS.find((m) => m.id === args.model && m.live) ?? CREATOR_MODELS.find((m) => m.id === "veo-3-1")!;
          const seconds = num(args.duration_seconds, model.durations[0]);
          const cost = await estimateCost({ mediaType: "video", model: model.id, seconds, resolution: "720p" });
          results.push(await launch(userId, { prompt: variantPrompt, mediaType: "video", model: model.id, resolution: "720p", duration: `${seconds}s`, aspectRatio: "9:16", imageUrl: null, imageUrls: [], creatorMode: "text", project_id: null }, cost));
        }
      }
      return { variants: results };
    },
  },
  {
    name: "create_ad_pack",
    description: "Pack publicité : à partir d'une photo de produit, lance une image publicitaire et une vidéo publicitaire (Veo 3.1). Débite les crédits des deux.",
    inputSchema: {
      type: "object",
      properties: {
        product_image_url: { type: "string", description: "Lien public de la photo du produit." },
        brief: { type: "string", maxLength: 1000, description: "Ce qu'il faut montrer : ambiance, décor, personne." },
      },
      required: ["product_image_url", "brief"],
    },
    run: async (userId, args) => {
      const img = str(args.product_image_url, 2000);
      const brief = str(args.brief, 1000);
      if (!img || !brief) return { error: "La photo du produit et le brief sont obligatoires." };
      const imageCost = await estimateCost({ mediaType: "image" });
      const image = await launch(userId, { prompt: `Image publicitaire : ${brief}`, mediaType: "image", resolution: "720p", duration: "", aspectRatio: "9:16", imageUrl: img, imageUrls: [img], creatorMode: null, model: null, project_id: null }, imageCost);
      const videoCost = await estimateCost({ mediaType: "video", model: "veo-3-1", seconds: 8, resolution: "720p" });
      const video = await launch(userId, { prompt: `Publicité vidéo : ${brief}`, mediaType: "video", model: "veo-3-1", resolution: "720p", duration: "8s", aspectRatio: "9:16", imageUrl: img, imageUrls: [img], creatorMode: "image", project_id: null }, videoCost);
      return { image, video, total_cost_credits: imageCost + videoCost };
    },
  },
  {
    name: "create_campaign",
    description: "Crée une campagne : un plan de publications (titre, texte, type, modèle) pour un produit. Ne lance rien ; utilise run_campaign_post pour générer chaque publication.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", maxLength: 80 },
        brief: { type: "string", maxLength: 1000 },
        product_image_url: { type: "string", description: "Lien public de la photo du produit (facultatif)." },
        posts: {
          type: "array",
          maxItems: 14,
          items: {
            type: "object",
            properties: {
              title: { type: "string", maxLength: 80 },
              prompt: { type: "string", maxLength: 2000 },
              media_type: { type: "string", enum: ["image", "video"] },
              model: { type: "string", enum: ALL_MODEL_IDS },
              duration_seconds: { type: "number" },
            },
            required: ["title", "prompt", "media_type"],
          },
        },
      },
      required: ["name", "posts"],
    },
    run: async (userId, args) => {
      const name = str(args.name, 80);
      const list = Array.isArray(args.posts) ? (args.posts as PostInput[]).slice(0, 14) : [];
      if (!name || list.length === 0) return { error: "Le nom et au moins une publication sont obligatoires." };
      const posts = list.map((p, i) => ({
        index: i,
        title: str(p.title, 80) || `Publication ${i + 1}`,
        prompt: str(p.prompt, 2000),
        media_type: p.media_type === "image" ? "image" : "video",
        model: typeof p.model === "string" && ALL_MODEL_IDS.includes(p.model) ? p.model : "veo-3-1",
        duration_seconds: num(p.duration_seconds, 8),
        status: "todo",
        generation_id: null,
      }));
      const { data, error } = await (await db())
        .from("campaigns")
        .insert({ user_id: userId, name, brief: str(args.brief, 1000) || null, product_image_url: str(args.product_image_url, 2000) || null, posts })
        .select("id, name, posts")
        .single();
      if (error) return { error: "Impossible de créer la campagne." };
      return data;
    },
  },
  {
    name: "list_campaigns",
    description: "Liste les campagnes de l'utilisateur, avec leur avancement.",
    inputSchema: { type: "object", properties: {} },
    run: async (userId) => {
      const { data } = await (await db())
        .from("campaigns")
        .select("id, name, created_at, posts")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? []).map((c: { id: string; name: string; created_at: string; posts: { status: string }[] }) => ({
        id: c.id,
        name: c.name,
        created_at: c.created_at,
        posts_total: c.posts.length,
        posts_launched: c.posts.filter((p) => p.status !== "todo").length,
      }));
    },
  },
  {
    name: "get_campaign",
    description: "Détail d'une campagne : chaque publication, son statut et le statut réel de sa génération.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    run: async (userId, args) => {
      const { data: c } = await (await db()).from("campaigns").select("id, name, brief, posts").eq("id", str(args.id, 64)).eq("user_id", userId).maybeSingle();
      if (!c) return { error: "Campagne introuvable." };
      const ids = (c.posts as { generation_id: string | null }[]).map((p) => p.generation_id).filter((x): x is string => !!x);
      const { data: gens } = ids.length
        ? await (await db()).from("generations").select("id, status, media_url").in("id", ids)
        : { data: [] as { id: string; status: string; media_url: string | null }[] };
      const byId = new Map((gens ?? []).map((g: { id: string; status: string; media_url: string | null }) => [g.id, g]));
      const posts = (c.posts as { generation_id: string | null; status: string }[]).map((p) => {
        const g = p.generation_id ? byId.get(p.generation_id) : undefined;
        return { ...p, live_status: g?.status ?? null, media_url: g?.media_url ?? null };
      });
      return { id: c.id, name: c.name, brief: c.brief, posts };
    },
  },
  {
    name: "run_campaign_post",
    description: "Lance la génération d'une publication de campagne (par son numéro, à partir de 0). Débite les crédits.",
    inputSchema: {
      type: "object",
      properties: { campaign_id: { type: "string" }, index: { type: "number", minimum: 0, maximum: 13 } },
      required: ["campaign_id", "index"],
    },
    run: async (userId, args) => {
      const { data: c } = await (await db()).from("campaigns").select("id, product_image_url, posts").eq("id", str(args.campaign_id, 64)).eq("user_id", userId).maybeSingle();
      if (!c) return { error: "Campagne introuvable." };
      const posts = c.posts as Array<Record<string, unknown>>;
      const i = num(args.index, -1);
      const post = posts[i];
      if (!post) return { error: "Numéro de publication inconnu." };
      if (post.status !== "todo") return { error: "Cette publication a déjà été lancée." };
      const prompt = String(post.prompt ?? "");
      const img = (post.media_type === "image" || post.model) && c.product_image_url ? String(c.product_image_url) : null;
      let result: Record<string, unknown>;
      if (post.media_type === "image") {
        const cost = await estimateCost({ mediaType: "image" });
        result = await launch(userId, { prompt, mediaType: "image", resolution: "720p", duration: "", aspectRatio: "9:16", imageUrl: img, imageUrls: img ? [img] : [], creatorMode: null, model: null, project_id: null }, cost);
      } else {
        const model = CREATOR_MODELS.find((m) => m.id === post.model && m.live) ?? CREATOR_MODELS.find((m) => m.id === "veo-3-1")!;
        const seconds = num(post.duration_seconds, model.durations[0]);
        const cost = await estimateCost({ mediaType: "video", model: model.id, seconds, resolution: "720p" });
        result = await launch(userId, { prompt, mediaType: "video", model: model.id, resolution: "720p", duration: `${seconds}s`, aspectRatio: "9:16", imageUrl: img, imageUrls: img ? [img] : [], creatorMode: img ? "image" : "text", project_id: null }, cost);
      }
      const generationId = typeof result.id === "string" ? result.id : null;
      posts[i] = { ...post, status: result.status === "started" ? "launched" : "failed", generation_id: generationId };
      await (await db()).from("campaigns").update({ posts, updated_at: new Date().toISOString() }).eq("id", c.id).eq("user_id", userId);
      return { index: i, ...result };
    },
  },
  {
    name: "clone_video",
    description: "Refait une vidéo à partir de TA vidéo source (clonage avec Seedance) : même mise en scène, ton produit ou ton texte. Débite les crédits. Confirme toujours que tu as les droits sur la vidéo.",
    inputSchema: {
      type: "object",
      properties: {
        source_video_url: { type: "string", description: "Lien public de la vidéo source." },
        prompt: { type: "string", maxLength: 2000, description: "Ce qu'il faut changer (produit, texte, décor)." },
        rights_confirmed: { type: "boolean", description: "Doit être true : la vidéo est la tienne, ou tu as l'accord de la personne qui y apparaît." },
        duration_seconds: { type: "number" },
      },
      required: ["source_video_url", "prompt", "rights_confirmed"],
    },
    run: async (userId, args) => {
      if (args.rights_confirmed !== true) {
        return { error: "Confirme d'abord que tu as les droits sur cette vidéo (rights_confirmed = true). Les stars, artistes et influenceurs sont interdits." };
      }
      const video = str(args.source_video_url, 2000);
      const prompt = str(args.prompt, 2000);
      if (!video || !prompt) return { error: "La vidéo source et le texte sont obligatoires." };
      const model = CREATOR_MODELS.find((m) => m.id === "seedance-2")!;
      const seconds = num(args.duration_seconds, 5);
      if (!model.durations.includes(seconds)) return { error: `Durée non prise en charge : ${model.durations.join(", ")} s.` };
      const cost = await estimateCost({ mediaType: "video", model: model.id, seconds, resolution: "720p" });
      return launch(userId, { prompt, mediaType: "video", model: model.id, resolution: "720p", duration: `${seconds}s`, aspectRatio: "9:16", imageUrl: null, imageUrls: [], videoUrl: video, creatorMode: null, project_id: null }, cost);
    },
  },
];
