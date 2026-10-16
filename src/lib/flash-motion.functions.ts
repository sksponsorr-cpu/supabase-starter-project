import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAILS } from "@/lib/owners";
import { CODE_MODELS, DEFAULT_CODE_MODEL, FLASH_MOTION } from "@/lib/flash-motion/config";

/** Motion AI n'est pas encore ouvert au public : réservé au propriétaire et aux administrateurs. */
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

const SOON = "Motion AI sera bientôt disponible.";

const REF_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_REF_BYTES = 4 * 1024 * 1024;

const briefSchema = z.object({
  idea: z.string().trim().min(5, "Décrivez votre idée en quelques mots.").max(1000),
  seconds: z.number().int().min(FLASH_MOTION.minDurationSeconds).max(FLASH_MOTION.maxDurationSeconds),
  withVoiceover: z.boolean(),
  format: z.enum(["vertical", "square", "landscape"]).optional().default("vertical"),
  voicePath: z.string().max(300).optional(),
  referencePaths: z.array(z.string().max(300)).max(3).optional().default([]),
  codeModelId: z
    .string()
    .refine((id) => CODE_MODELS.some((m) => m.id === id), "Modèle inconnu")
    .optional()
    .default(DEFAULT_CODE_MODEL),
});

/** Enregistre la demande en file. Le worker fait le reste (script, voix, code, rendu). */
export const createMotionVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => briefSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isAdminUser(context))) return { ok: false as const, message: SOON };
    const jobId = crypto.randomUUID();
    // Seules les références de l'utilisateur connecté sont acceptées.
    const refs = data.referencePaths.filter((p) => p.startsWith(`${context.userId}/refs/`));
    const voicePath = data.voicePath && data.voicePath.startsWith(`${context.userId}/voices/`) ? data.voicePath : null;
    const { error } = await context.supabase.from("flash_motion_jobs").insert({
      id: jobId,
      user_id: context.userId,
      idea: data.idea,
      seconds: data.seconds,
      with_voiceover: data.withVoiceover,
      code_model: data.codeModelId,
      format: data.format,
      voice_path: voicePath,
      reference_paths: refs,
      status: "queued",
    });
    if (error) {
      console.error("[flash-motion] insertion", error.message);
      return { ok: false as const, message: "Impossible d'enregistrer la demande. Réessayez." };
    }
    return { ok: true as const, jobId };
  });

/** Lit l'état d'un job de l'utilisateur connecté. */
export const getMotionVideo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: job, error } = await context.supabase
      .from("flash_motion_jobs")
      .select("id, status, error, video_path")
      .eq("id", data.jobId)
      .maybeSingle();
    if (error || !job) return { ok: false as const, message: "Vidéo introuvable." };

    let videoUrl: string | null = null;
    if (job.status === "ready" && job.video_path) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const signed = await supabaseAdmin.storage.from("flash-motion").createSignedUrl(job.video_path, 60 * 60 * 6);
      videoUrl = signed.data?.signedUrl ?? null;
    }
    return { ok: true as const, status: job.status, error: job.error, videoUrl };
  });


/** Historique : les dernières vidéos de l'utilisateur, avec leur progression. */
export const listMotionVideos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("flash_motion_jobs")
      .select("id, idea, seconds, status, stage, progress, error, video_path, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return { ok: false as const, rows: [] as never[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = await Promise.all(
      (data ?? []).map(async (j) => {
        let videoUrl: string | null = null;
        if (j.status === "ready" && j.video_path) {
          const signed = await supabaseAdmin.storage.from("flash-motion").createSignedUrl(j.video_path, 60 * 60 * 6);
          videoUrl = signed.data?.signedUrl ?? null;
        }
        return {
          id: j.id as string,
          idea: j.idea as string,
          seconds: j.seconds as number,
          status: j.status as "queued" | "rendering" | "ready" | "failed",
          stage: (j.stage as string | null) ?? null,
          progress: (j.progress as number | null) ?? 0,
          error: (j.error as string | null) ?? null,
          createdAt: j.created_at as string,
          videoUrl,
        };
      }),
    );
    return { ok: true as const, rows };
  });


/** Envoie une image de référence (JPG, PNG ou WebP, 4 Mo maximum) et renvoie son chemin. */
export const uploadMotionReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ mime: z.string().max(40), dataBase64: z.string().min(10).max(6_000_000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdminUser(context))) return { ok: false as const, message: SOON };
    const ext = REF_TYPES[data.mime];
    if (!ext) return { ok: false as const, message: "Format non accepté. Utilisez JPG, PNG ou WebP." };
    const bytes = Buffer.from(data.dataBase64, "base64");
    if (bytes.length > MAX_REF_BYTES) return { ok: false as const, message: "Image trop lourde (4 Mo maximum)." };
    const path = `${context.userId}/refs/${crypto.randomUUID()}.${ext}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const up = await supabaseAdmin.storage
      .from("flash-motion")
      .upload(path, bytes, { contentType: data.mime, upsert: false });
    if (up.error) return { ok: false as const, message: "Envoi impossible. Réessayez." };
    return { ok: true as const, path };
  });


const AUDIO_TYPES: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

/** Envoie un vocal (MP3, M4A ou WAV, 4 Mo maximum) : il remplacera la voix générée. */
export const uploadMotionVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ mime: z.string().max(40), dataBase64: z.string().min(10).max(6_000_000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdminUser(context))) return { ok: false as const, message: SOON };
    const ext = AUDIO_TYPES[data.mime];
    if (!ext) return { ok: false as const, message: "Format audio non accepté. Utilisez MP3, M4A ou WAV." };
    const bytes = Buffer.from(data.dataBase64, "base64");
    if (bytes.length > MAX_AUDIO_BYTES) return { ok: false as const, message: "Vocal trop lourd (4 Mo maximum)." };
    const path = `${context.userId}/voices/${crypto.randomUUID()}.${ext}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const up = await supabaseAdmin.storage
      .from("flash-motion")
      .upload(path, bytes, { contentType: data.mime, upsert: false });
    if (up.error) return { ok: false as const, message: "Envoi impossible. Réessayez." };
    return { ok: true as const, path };
  });
