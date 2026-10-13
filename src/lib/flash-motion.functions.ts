import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildMotionVideo } from "@/lib/flash-motion/pipeline.server";
import { CODE_MODELS, DEFAULT_CODE_MODEL, FLASH_MOTION } from "@/lib/flash-motion/config";

const briefSchema = z.object({
  idea: z.string().trim().min(5, "Décrivez votre idée en quelques mots.").max(1000),
  seconds: z.number().int().min(FLASH_MOTION.minDurationSeconds).max(FLASH_MOTION.maxDurationSeconds),
  withVoiceover: z.boolean(),
  codeModelId: z.string().refine((id) => CODE_MODELS.some((m) => m.id === id), "Modèle inconnu")
    .optional()
    .default(DEFAULT_CODE_MODEL),
});

/** Crée un job de vidéo : génère le script et le code, puis le met en file pour le worker. */
export const createMotionVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => briefSchema.parse(input))
  .handler(async ({ data, context }) => {
    try {
      const result = await buildMotionVideo({
        idea: data.idea,
        seconds: data.seconds,
        withVoiceover: data.withVoiceover,
        codeModelId: data.codeModelId,
      });

      // La voix off (si elle existe) est rangée dans le stockage privé.
      const jobId = crypto.randomUUID();
      let audioPath: string | null = null;
      if (result.audio) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        audioPath = `${context.userId}/${jobId}.mp3`;
        const up = await supabaseAdmin.storage
          .from("flash-motion")
          .upload(audioPath, result.audio, { contentType: "audio/mpeg", upsert: true });
        if (up.error) throw new Error("Enregistrement de la voix off impossible");
      }

      // Insertion du job. Le client de l'utilisateur est soumis aux règles RLS de la table.
      const { error } = await context.supabase.from("flash_motion_jobs").insert({
        id: jobId,
        user_id: context.userId,
        idea: data.idea,
        seconds: result.seconds,
        with_voiceover: result.withVoiceover,
        status: "queued",
        html: result.html,
        audio_path: audioPath,
      });
      if (error) throw new Error("Impossible de créer la vidéo pour le moment");

      return { ok: true as const, jobId, codeModel: result.codeModel };
    } catch (err) {
      console.error("[flash-motion] création", err);
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      return { ok: false as const, message: "La création a échoué. Réessayez dans un instant." };
    }
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
