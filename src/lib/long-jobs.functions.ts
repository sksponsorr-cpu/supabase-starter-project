import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { startLongJob } from "@/lib/long-jobs.server";
import type { Resolution } from "@/lib/credits";

const RESOLUTIONS: Resolution[] = ["480p", "720p"];

/** Lance une vidéo longue pour l'utilisateur connecté. */
export const launchLongVideo = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const r = (input ?? {}) as Record<string, unknown>;
    const prompt = typeof r["prompt"] === "string" ? r["prompt"].trim().slice(0, 1000) : "";
    const seconds = Number(r["seconds"]);
    const resolution = RESOLUTIONS.includes(r["resolution"] as Resolution) ? (r["resolution"] as Resolution) : "480p";
    if (!prompt) throw new Error("Décrivez la vidéo.");
    if (!Number.isInteger(seconds) || seconds < 10 || seconds > 180) throw new Error("Durée invalide.");
    const modelId = typeof r["modelId"] === "string" ? (r["modelId"] as string).slice(0, 40) : null;
    return { prompt, seconds, resolution, modelId };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { modelBlockMessage } = await import("@/lib/model-switches.server");
    const blocked = data.modelId ? await modelBlockMessage(data.modelId) : null;
    if (blocked) return { ok: false as const, message: blocked };
    const res = await startLongJob({ userId: context.userId, ...data });
    if (!res.ok) return { ok: false as const, message: res.message };
    return { ok: true as const, jobId: res.jobId };
  });

/** Liste les vidéos longues de l'utilisateur, avec leur progression (pour « Mes créations »). */
export const listLongVideos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const { data } = await db
      .from("long_jobs")
      .select("id, prompt, resolution, target_seconds, seconds_done, status, final_url, error_message, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return { jobs: data ?? [] };
  });
