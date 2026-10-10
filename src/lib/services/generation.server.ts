/**
 * Logique serveur de génération de médias (Fal.ai / Grok Imagine).
 * Règle de quota : la réservation est atomique puis remboursée intégralement
 * si le moteur échoue ou si le média n'est pas affichable.
 *
 * Limites offre découverte :
 *  - 5 images par jour
 *  - 9 vidéos par jour, avec une pause de 3 h après la 5ᵉ vidéo
 * Vidéos : 6 secondes maximum, 480p ou 720p.
 */

import { creditCostFor } from "@/lib/credits";

export type GenerationInput = {
  prompt: string;
  mediaType: "image" | "video";
  resolution: string;
  duration: string;
  aspectRatio: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  project_id?: string | null;
};

export type GenerationRow = {
  id: string;
  prompt: string;
  media_type: string;
  resolution: string | null;
  duration: string | null;
  aspect_ratio: string | null;
  media_url: string | null;
  storage_path?: string | null;
  status: string;
  duration_seconds: number;
  error_message: string | null;
  created_at: string;
};

export type QuotaReason =
  | "insufficient_credits"
  | "image_daily"
  | "video_daily"
  | "video_pause"
  | "video_seconds"
  | "device_free_used"
  | "subscription_required"
  | "subscription_expired";

export type GenerationResult =
  | { ok: true; id: string | null; status: "ready" | "pending"; mediaUrl?: string; seconds: number }
  | {
      ok: false;
      reason: "quota";
      code: QuotaReason;
      retryAt: string | null;
      remainingSeconds?: number;
      limitSeconds?: number;
      message?: string | null;
    }
  | { ok: false; reason: "error"; message: string; id: string | null };


const SIGNED_URL_TTL = 60 * 60 * 6;

function extensionFor(contentType: string): string {
  if (contentType.includes("video")) return contentType.includes("webm") ? "webm" : "mp4";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  return "png";
}

/** Régénère des URL signées fraîches à partir des chemins de stockage. */
export async function withFreshUrls<T extends GenerationRow>(rows: T[]): Promise<T[]> {
  const paths = rows.map((r) => r.storage_path).filter((p): p is string => Boolean(p));
  if (paths.length === 0) return rows;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const signed = new Map<string, string>();

  await Promise.all(
    paths.map(async (path) => {
      const { data } = await supabaseAdmin.storage
        .from("generations")
        .createSignedUrl(path, SIGNED_URL_TTL);
      if (data?.signedUrl) signed.set(path, data.signedUrl);
    }),
  );

  return rows.map((row) =>
    row.storage_path && signed.has(row.storage_path)
      ? { ...row, media_url: signed.get(row.storage_path)! }
      : row,
  );
}

type MediaOutcome =
  | { ok: true; isImmediate: true; bytes: Uint8Array | null; contentType: string; mediaUrl: string | null }
  | { ok: true; isImmediate: false; requestId: string; statusUrl: string; responseUrl: string }
  | { ok: false; error: string };

/** Génération image : Fal.ai (Grok Imagine, repli Flux Schnell). */
async function generateImage(input: GenerationInput): Promise<MediaOutcome> {
  const { isFalConfigured, generateImageWithFal } = await import("@/lib/services/fal.server");
  if (!isFalConfigured()) {
    return { ok: false, error: "Le moteur de génération d'images n'est pas disponible." };
  }
  const result = await generateImageWithFal(input);
  if (!result.ok) return { ok: false, error: result.error };
  if (result.isImmediate) {
    return {
      ok: true,
      isImmediate: true,
      bytes: result.bytes,
      contentType: result.contentType,
      mediaUrl: result.bytes ? null : result.mediaUrl,
    };
  }
  return {
    ok: true,
    isImmediate: false,
    requestId: result.requestId,
    statusUrl: result.statusUrl,
    responseUrl: result.responseUrl,
  };
}

/** Génération vidéo : Fal.ai (text-to-video, image-to-video ou montage). */
async function generateVideo(input: GenerationInput): Promise<MediaOutcome> {
  const { isFalConfigured, generateVideoWithFal } = await import("@/lib/services/fal.server");
  if (!isFalConfigured()) {
    return { ok: false, error: "Le moteur de génération vidéo n'est pas disponible." };
  }
  const result = await generateVideoWithFal(input);
  if (!result.ok) return { ok: false, error: result.error };
  if (result.isImmediate) {
    return {
      ok: true,
      isImmediate: true,
      bytes: result.bytes,
      contentType: result.contentType,
      mediaUrl: result.bytes ? null : result.mediaUrl,
    };
  }
  return {
    ok: true,
    isImmediate: false,
    requestId: result.requestId,
    statusUrl: result.statusUrl,
    responseUrl: result.responseUrl,
  };
}

export function secondsFor(input: GenerationInput): number {
  if (input.mediaType !== "video") return 2;
  const parsed = Number.parseInt(input.duration, 10);
  const allowed = [5, 8, 10];
  return allowed.includes(parsed) ? parsed : 5;
}

/** Exécute une génération complète pour un utilisateur donné. */
export async function runGeneration(
  userId: string,
  input: GenerationInput,
): Promise<GenerationResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const seconds = secondsFor(input);
  const isVideo = input.mediaType === "video";

  const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", userId).maybeSingle();
  const isAdmin = profile?.role === "admin";

  // Contrôle d'accès préalable : aucun appel au moteur si l'utilisateur n'a
  // ni abonnement actif ni offre gratuite disponible sur cet appareil.
  const { checkGenerationAccess } = await import("@/lib/services/access.server");
  const access = await checkGenerationAccess(userId, input.mediaType, isVideo ? seconds : 0);
  if (!access.allowed) {
    return {
      ok: false,
      reason: "quota",
      code: access.code as QuotaReason,
      retryAt: null,
      remainingSeconds: access.remainingSeconds,
      limitSeconds: access.limitSeconds,
      message: access.message,
    };
  }

  // Abonnés : décompte en crédits. Gratuit : quota existant inchangé.
  let creditCost: number | null = !isAdmin ? creditCostFor(input.mediaType, seconds, input.resolution) : null;
  if (creditCost !== null) {
    const { data: spent, error: spendError } = await supabaseAdmin.rpc("spend_credits", {
      p_user: userId,
      p_amount: creditCost,
      p_ref: crypto.randomUUID(),
    });
    if (spendError) throw new Error(spendError.message);
    if (!spent) {
      return {
        ok: false,
        reason: "quota",
        code: "insufficient_credits",
        retryAt: null,
        remainingSeconds: 0,
        limitSeconds: 0,
      };
    }
  }
  if (creditCost === null && !isAdmin) {
  if (isVideo) {
    // Pipeline strict : abonnement valide + solde de secondes suffisant,
    // vérifiés en base avant tout appel au moteur de génération.
    const { data: reserved, error: reserveError } = await supabaseAdmin.rpc(
      "reserve_video_seconds",
      { _user_id: userId, _seconds: seconds },
    );
    if (reserveError) throw new Error(reserveError.message);

    const row = Array.isArray(reserved) ? reserved[0] : reserved;
    if (!row?.allowed) {
      return {
        ok: false,
        reason: "quota",
        code: (row?.reason ?? "video_seconds") as QuotaReason,
        retryAt: row?.period_end ?? null,
        remainingSeconds: row?.remaining_seconds ?? 0,
        limitSeconds: row?.limit_seconds ?? 0,
      };
    }
  } else {
    const { data: reserved, error: reserveError } = await supabaseAdmin.rpc("reserve_media_quota", {
      _user_id: userId,
      _media_type: input.mediaType,
    });
    if (reserveError) throw new Error(reserveError.message);

    const row = Array.isArray(reserved) ? reserved[0] : reserved;
    if (!row?.allowed) {
      return {
        ok: false,
        reason: "quota",
        code: (row?.reason ?? "image_daily") as QuotaReason,
        retryAt: row?.retry_at ?? null,
      };
    }
  }
  }

  let debited = !isAdmin;
  const refund = async () => {
    if (!debited) return;
    debited = false;
    if (creditCost !== null) {
      await supabaseAdmin.rpc("add_credits", {
        p_user: userId,
        p_amount: creditCost,
        p_kind: "remboursement",
        p_ref: "echec-generation",
      });
      return;
    }
    if (isVideo) {
      await supabaseAdmin.rpc("refund_video_seconds", { _user_id: userId, _seconds: seconds });
    } else {
      await supabaseAdmin.rpc("refund_media_quota", {
        _user_id: userId,
        _media_type: input.mediaType,
      });
    }
  };


  const persist = async (fields: {
    mediaUrl: string | null;
    storagePath: string | null;
    status: string;
    errorMessage: string | null;
  }) => {
    const { data: inserted } = await supabaseAdmin
      .from("generations")
      .insert({
        user_id: userId,
        prompt: input.prompt,
        media_type: input.mediaType,
        resolution: input.resolution,
        duration: input.duration,
        aspect_ratio: input.aspectRatio,
        project_id: input.project_id || null,
        media_url: fields.mediaUrl,
        storage_path: fields.storagePath,
        duration_seconds: fields.status === "ready" ? seconds : 0,
        status: fields.status,
        error_message: fields.errorMessage,
      })
      .select("id")
      .single();
    return inserted?.id ?? null;
  };

  try {
    const outcome =
      input.mediaType === "image" ? await generateImage(input) : await generateVideo(input);
    if (!outcome.ok) throw new Error(outcome.error);

    if (outcome.isImmediate) {
      let mediaUrl = outcome.mediaUrl;
      let storagePath: string | null = null;
const r2 = await import("@/lib/services/r2.server");
      if (outcome.bytes && r2.isR2Configured()) {
        mediaUrl = await r2.uploadToR2(
          `${userId}/${crypto.randomUUID()}.${extensionFor(outcome.contentType)}`,
          outcome.bytes,
          outcome.contentType,
        );
        outcome.bytes = null;
      }
      if (outcome.bytes) {
        const path = `${userId}/${crypto.randomUUID()}.${extensionFor(outcome.contentType)}`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("generations")
          .upload(path, outcome.bytes, { contentType: outcome.contentType });
        if (upErr) throw new Error(upErr.message);

        const { data: signed } = await supabaseAdmin.storage
          .from("generations")
          .createSignedUrl(path, SIGNED_URL_TTL);
        storagePath = path;
        mediaUrl = signed?.signedUrl ?? null;
      }

      if (!mediaUrl) throw new Error("Média indisponible : aucun crédit n'a été débité");

      const id = await persist({ mediaUrl, storagePath, status: "ready", errorMessage: null });

      if (id) {
        await supabaseAdmin.from("community_gallery").insert({
          generation_id: id,
          user_id: userId,
          prompt: input.prompt,
          media_type: input.mediaType,
          media_url: mediaUrl,
          storage_path: storagePath,
          status: "en_attente",
        });
      }

      return { ok: true, id, status: "ready", mediaUrl, seconds };
    } else {
      // Async / queued case
      const payloadStr = JSON.stringify({
        request_id: outcome.requestId,
        status_url: outcome.statusUrl,
        response_url: outcome.responseUrl,
      });

      const id = await persist({
        mediaUrl: null,
        storagePath: null,
        status: "pending",
        errorMessage: `fal:${payloadStr}`,
      });

      return { ok: true, id, status: "pending", seconds };
    }
  } catch (error) {
    await refund();
    console.error("[GENERATION-ERROR] runGeneration failed:", error);
    const { sanitizeGenerationError } = await import("@/lib/services/fal.server");
    const sanitized = sanitizeGenerationError(error);
    const id = await persist({
      mediaUrl: null,
      storagePath: null,
      status: "error",
      errorMessage: sanitized,
    });
    return { ok: false, reason: "error", message: sanitized, id };
  }
}


/* ------------------------------------------------------------------ */
/* Finalisation des générations asynchrones (Fal.ai)                    */
/* ------------------------------------------------------------------ */

/** Au-delà de ce délai, une tâche encore "pending" est considérée comme perdue. */
const PENDING_TIMEOUT_MS = 10 * 60 * 1000;

type PendingRowInput = {
  id: string;
  user_id?: string;
  prompt: string;
  media_type: string;
  resolution?: string | null;
  duration: string | null;
  aspect_ratio: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
};

export type PendingFinalizeResult =
  | { ok: true; status: "ready"; mediaUrl: string | null }
  | { ok: true; status: "pending" }
  | { ok: true; status: "error"; error: string }
  | { ok: false; error: string };

async function refundPendingRow(row: PendingRowInput, userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (row.media_type === "video") {
    const seconds = secondsFor({ mediaType: "video", duration: row.duration ?? "5" } as GenerationInput);
    await supabaseAdmin.rpc("refund_video_seconds", { _user_id: userId, _seconds: seconds });
  } else {
    await supabaseAdmin.rpc("refund_media_quota", { _user_id: userId, _media_type: row.media_type });
  }
}

/** Passe la ligne en "error" puis rembourse une seule fois (garde-fou contre les doublons). */
async function failPendingRow(
  row: PendingRowInput,
  userId: string,
  message: string,
): Promise<PendingFinalizeResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: claimed } = await supabaseAdmin
    .from("generations")
    .update({ status: "error", error_message: message })
    .eq("id", row.id)
    .eq("status", "pending")
    .select("id");
  if (claimed?.length) await refundPendingRow(row, userId);
  return { ok: true, status: "error", error: message };
}

async function storeFinalMedia(
  userId: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<{ mediaUrl: string | null; storagePath: string | null }> {
  const path = `${userId}/${crypto.randomUUID()}.${extensionFor(contentType)}`;
  const r2 = await import("@/lib/services/r2.server");
  if (r2.isR2Configured()) {
    const url = await r2.uploadToR2(path, bytes, contentType);
    return { mediaUrl: url, storagePath: null };
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: upErr } = await supabaseAdmin.storage.from("generations").upload(path, bytes, { contentType });
  if (upErr) throw new Error(upErr.message);
  const { data: signed } = await supabaseAdmin.storage
    .from("generations")
    .createSignedUrl(path, SIGNED_URL_TTL);
  return { mediaUrl: signed?.signedUrl ?? null, storagePath: path };
}

/**
 * Interroge Fal.ai pour une ligne "pending" (error_message = "fal:{...}").
 * - terminée : média stocké, ligne passée en "ready", ajoutée à la galerie
 * - en échec : ligne en "error", crédit remboursé
 * - en cours : "pending" (sauf si trop ancienne : traitée comme perdue et remboursée)
 */
export async function finalizePendingRow(
  row: PendingRowInput,
  userId: string,
): Promise<PendingFinalizeResult> {
  if (row.status !== "pending") {
    return row.status === "ready"
      ? { ok: true, status: "ready", mediaUrl: null }
      : { ok: true, status: "error", error: row.error_message ?? "Génération indisponible" };
  }

  const genericError =
    "Une erreur est survenue pendant la génération. Réessayez. Vos secondes ne sont pas décomptées.";
  const raw = row.error_message ?? "";
  if (!raw.startsWith("fal:")) return { ok: false, error: "Pas de tâche asynchrone associée" };

  let payload: { status_url?: string; response_url?: string };
  try {
    payload = JSON.parse(raw.slice(4));
  } catch {
    return failPendingRow(row, userId, genericError);
  }
  if (!payload.status_url || !payload.response_url) {
    return failPendingRow(row, userId, genericError);
  }

  const { checkModelStatus, sanitizeGenerationError } = await import("@/lib/services/fal.server");
  const kind = row.media_type === "video" ? "video" : "image";
  const result = await checkModelStatus(payload.status_url, payload.response_url, kind);

  if (result.status === "pending") {
    const age = Date.now() - new Date(row.created_at).getTime();
    if (age < PENDING_TIMEOUT_MS) return { ok: true, status: "pending" };
    return failPendingRow(
      row,
      userId,
      "La génération a pris trop de temps. Réessayez. Vos secondes ne sont pas décomptées.",
    );
  }

  if (result.status === "error") {
    return failPendingRow(row, userId, sanitizeGenerationError(result.error));
  }

  // status === "completed"
  const stored = result.bytes
    ? await storeFinalMedia(userId, result.bytes, result.contentType)
    : { mediaUrl: result.mediaUrl, storagePath: null as string | null };
  if (!stored.mediaUrl) {
    return failPendingRow(row, userId, "Média généré mais inaccessible. Vos secondes ne sont pas décomptées.");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: claimed } = await supabaseAdmin
    .from("generations")
    .update({
      status: "ready",
      media_url: stored.mediaUrl,
      storage_path: stored.storagePath,
      error_message: null,
      duration_seconds:
        row.media_type === "video"
          ? secondsFor({ mediaType: "video", duration: row.duration ?? "5" } as GenerationInput)
          : 0,
    })
    .eq("id", row.id)
    .eq("status", "pending")
    .select("id");

  if (claimed?.length) {
    await supabaseAdmin.from("community_gallery").insert({
      generation_id: row.id,
      user_id: userId,
      prompt: row.prompt,
      media_type: row.media_type,
      media_url: stored.mediaUrl,
      storage_path: stored.storagePath,
      status: "en_attente",
    });
  }

  return { ok: true, status: "ready", mediaUrl: stored.mediaUrl };
}
