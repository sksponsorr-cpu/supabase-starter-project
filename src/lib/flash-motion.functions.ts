import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CODE_MODELS, DEFAULT_CODE_MODEL, FLASH_MOTION } from "@/lib/flash-motion/config";

const briefSchema = z.object({
  idea: z.string().trim().min(5, "Décrivez votre idée en quelques mots.").max(1000),
  seconds: z.number().int().min(FLASH_MOTION.minDurationSeconds).max(FLASH_MOTION.maxDurationSeconds),
  withVoiceover: z.boolean(),
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
    const jobId = crypto.randomUUID();
    const { error } = await context.supabase.from("flash_motion_jobs").insert({
      id: jobId,
      user_id: context.userId,
      idea: data.idea,
      seconds: data.seconds,
      with_voiceover: data.withVoiceover,
      code_model: data.codeModelId,
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
