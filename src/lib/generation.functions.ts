import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TIER_DAILY_SECONDS, type Tier } from "@/lib/quota";

type GenerateInput = {
  prompt: string;
  mediaType: "image" | "video";
  resolution: string;
  duration: string;
  aspectRatio: string;
};

function normalize(input: GenerateInput) {
  if (!input?.prompt?.trim()) throw new Error("Prompt requis");
  const mediaType = input.mediaType === "image" ? ("image" as const) : ("video" as const);
  let resolution = String(input.resolution ?? "720p");
  // Les vidéos sont limitées à 720p et 6 secondes.
  if (mediaType === "video" && resolution !== "480p") resolution = "720p";
  const seconds = Math.min(6, Number.parseInt(String(input.duration ?? "6"), 10) || 6);
  return {
    prompt: input.prompt.trim().slice(0, 2000),
    mediaType,
    resolution,
    duration: `${seconds}s`,
    aspectRatio: String(input.aspectRatio ?? "2:3"),
  };
}

export const getQuotaStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);

    const [{ data: sub }, { data: usage }] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("tier, status, ends_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("daily_usage")
        .select("seconds_used")
        .eq("user_id", userId)
        .eq("usage_date", today)
        .maybeSingle(),
    ]);

    const active =
      sub && sub.status === "active" && (!sub.ends_at || new Date(sub.ends_at) > new Date());
    const tier = (active ? (sub.tier as Tier) : "free") satisfies Tier;
    const limit = TIER_DAILY_SECONDS[tier] ?? TIER_DAILY_SECONDS.free;
    const used = usage?.seconds_used ?? 0;

    return { tier, limit, used, remaining: Math.max(0, limit - used) };
  });

export const listGenerations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { withFreshUrls } = await import("@/lib/services/generation.server");
    const { data } = await context.supabase
      .from("generations")
      .select(
        "id, prompt, media_type, resolution, duration, aspect_ratio, media_url, storage_path, status, duration_seconds, error_message, created_at",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    // Les URL signées expirent : on les régénère à chaque lecture depuis storage_path.
    return await withFreshUrls(data ?? []);
  });

export const generateMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(normalize)
  .handler(async ({ data, context }) => {
    const { runGeneration } = await import("@/lib/services/generation.server");
    return await runGeneration(context.userId, data);
  });

/** Relance une génération en échec à partir de ses paramètres enregistrés. */
export const retryGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Identifiant manquant");
    return { id: String(input.id) };
  })
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("generations")
      .select("prompt, media_type, resolution, duration, aspect_ratio, status")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!row) throw new Error("Création introuvable");

    const { runGeneration } = await import("@/lib/services/generation.server");
    return await runGeneration(
      context.userId,
      normalize({
        prompt: row.prompt,
        mediaType: row.media_type === "image" ? "image" : "video",
        resolution: row.resolution ?? "720p",
        duration: row.duration ?? "6s",
        aspectRatio: row.aspect_ratio ?? "2:3",
      }),
    );
  });

/** Supprime définitivement une création de l'utilisateur (fichier + enregistrement). */
export const deleteGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Identifiant manquant");
    return { id: String(input.id) };
  })
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("generations")
      .select("id, storage_path")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!row) return { ok: false as const, message: "Création introuvable." };

    if (row.storage_path) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from("generations").remove([row.storage_path]);
    }

    const { error } = await context.supabase
      .from("generations")
      .delete()
      .eq("id", row.id)
      .eq("user_id", context.userId);

    if (error) return { ok: false as const, message: "Suppression impossible." };
    return { ok: true as const };
  });
export const checkGenerationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("ID manquant");
    return { id: String(input.id) };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("generations")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!row) return { ok: false as const, error: "Introuvable" };
    if (row.status !== "pending") {
      return { ok: true as const, status: row.status, mediaUrl: row.media_url };
    }

    if (!row.error_message?.startsWith("fal:")) {
      return { ok: false as const, error: "Pas de tâche asynchrone associée" };
    }

    try {
      const payload = JSON.parse(row.error_message.slice(4));
      const { checkModelStatus } = await import("@/lib/services/fal.server");
      const statusRes = await checkModelStatus(payload.status_url, payload.response_url, row.media_type as "image" | "video");

      if (statusRes.status === "pending") {
        return { ok: true as const, status: "pending" };
      }

      if (statusRes.status === "error") {
        // Remboursement
        const { secondsFor } = await import("@/lib/services/generation.server");
        const seconds = secondsFor({ mediaType: row.media_type as "image" | "video", duration: row.duration || "6s" } as any);
        if (row.media_type === "video") {
          await supabaseAdmin.rpc("refund_video_seconds", { _user_id: context.userId, _seconds: seconds });
        } else {
          await supabaseAdmin.rpc("refund_media_quota", { _user_id: context.userId, _media_type: row.media_type });
        }

        await supabaseAdmin
          .from("generations")
          .update({ status: "error", error_message: statusRes.error })
          .eq("id", data.id);
        
        return { ok: true as const, status: "error", error: statusRes.error };
      }

      // Succès
      let mediaUrl = statusRes.mediaUrl;
      let storagePath: string | null = null;
      if (statusRes.bytes) {
        const path = ${context.userId}/.;
        await supabaseAdmin.storage.from("generations").upload(path, statusRes.bytes, { contentType: statusRes.contentType });
        const { data: signed } = await supabaseAdmin.storage.from("generations").createSignedUrl(path, 60 * 60 * 6);
        storagePath = path;
        mediaUrl = signed?.signedUrl ?? mediaUrl;
      }

      await supabaseAdmin
        .from("generations")
        .update({ status: "ready", media_url: mediaUrl, storage_path: storagePath, error_message: null })
        .eq("id", data.id);

      await supabaseAdmin.from("community_gallery").insert({
        generation_id: data.id,
        user_id: context.userId,
        prompt: row.prompt,
        media_type: row.media_type,
        media_url: mediaUrl,
        storage_path: storagePath,
        status: "en_attente",
      });

      return { ok: true as const, status: "ready", mediaUrl };
    } catch (e) {
      return { ok: false as const, error: "Erreur de suivi" };
    }
  });
