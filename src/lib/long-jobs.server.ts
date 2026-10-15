import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { creditCostFor, type Resolution } from "@/lib/credits";
import { getCreditConfig } from "@/lib/credits.server";

/**
 * Vidéos longues, entièrement sur fal.ai.
 * Étapes : génération (15 s) -> découpe des 2 dernières secondes -> prolongation (10 s)
 * -> découpe des 10 nouvelles secondes -> ... -> assemblage final.
 * Chaque étape est lancée par le webhook fal.ai (voir fal-webhook.ts).
 */

const QUEUE = "https://queue.fal.run";
const MODEL = {
  textToVideo: "xai/grok-imagine-video/text-to-video",
  extend: "xai/grok-imagine-video/extend-video",
  trim: "fal-ai/workflow-utilities/trim-video",
  merge: "fal-ai/ffmpeg-api/merge-videos",
} as const;

const FIRST_MAX = 15; // secondes max par génération initiale
const EXTEND_MAX = 10; // secondes max ajoutées par prolongation
const TAIL = 2; // secondes reprises pour raccorder

type Step = "generate" | "trim_tail" | "extend" | "trim_new" | "merge";

function webhookUrl(): string {
  const base = process.env["PUBLIC_APP_URL"] ?? "";
  return `${base.replace(/\/$/, "")}/api/public/webhooks/fal`;
}

async function submit(model: string, input: Record<string, unknown>): Promise<string> {
  const key = process.env["FAL_KEY"];
  if (!key) throw new Error("FAL_KEY manquante");
  const url = `${QUEUE}/${model}?fal_webhook=${encodeURIComponent(webhookUrl())}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = (await res.json().catch(() => ({}))) as { request_id?: string; detail?: string };
  if (!res.ok || !json.request_id) throw new Error(json.detail ?? `fal.ai HTTP ${res.status}`);
  return json.request_id;
}

async function setStep(jobId: string, step: Step, requestId: string | null, fields: Record<string, unknown> = {}) {
  await supabaseAdmin
    .from("long_jobs")
    .update({ current_step: step, current_request_id: requestId, updated_at: new Date().toISOString(), ...fields })
    .eq("id", jobId);
}

async function fail(jobId: string, userId: string, creditsSpent: number, message: string) {
  await supabaseAdmin
    .from("long_jobs")
    .update({ status: "failed", error_message: message, updated_at: new Date().toISOString() })
    .eq("id", jobId);
  // Remboursement, même logique que les générations.
  await supabaseAdmin.rpc("add_credits", {
    p_user: userId,
    p_amount: creditsSpent,
    p_kind: "remboursement",
    p_ref: `long-job-${jobId}`,
  });
}

/** Lance une vidéo longue : débite les crédits, crée la ligne, lance la première génération. */
export async function startLongJob(input: {
  userId: string;
  prompt: string;
  resolution: Resolution;
  seconds: number;
}): Promise<{ ok: true; jobId: string } | { ok: false; message: string }> {
  const config = await getCreditConfig();
  const cost = creditCostFor("video", input.seconds, input.resolution, config);

  const { data: spent, error: spendError } = await supabaseAdmin.rpc("spend_credits", {
    p_user: input.userId,
    p_amount: cost,
    p_ref: crypto.randomUUID(),
  });
  if (spendError) return { ok: false, message: spendError.message };
  if (!spent) return { ok: false, message: "Crédits insuffisants." };

  const { data: row, error } = await supabaseAdmin
    .from("long_jobs")
    .insert({
      user_id: input.userId,
      prompt: input.prompt,
      resolution: input.resolution,
      target_seconds: input.seconds,
      credits_spent: cost,
      status: "running",
    })
    .select("id")
    .single();
  if (error || !row) return { ok: false, message: "Création impossible." };

  try {
    const first = Math.min(FIRST_MAX, input.seconds);
    const requestId = await submit(MODEL.textToVideo, {
      prompt: input.prompt,
      duration: first,
      resolution: input.resolution,
    });
    await setStep(row.id, "generate", requestId, { seconds_done: 0 });
    return { ok: true, jobId: row.id };
  } catch (e) {
    await fail(row.id, input.userId, cost, e instanceof Error ? e.message : "Erreur de lancement");
    return { ok: false, message: "Le lancement a échoué. Vos crédits ont été rendus." };
  }
}

/** Appelé par le webhook quand une étape fal.ai est terminée. */
export async function handleStepResult(requestId: string, videoUrl: string | null, errorMessage?: string) {
  const { data: job } = await supabaseAdmin
    .from("long_jobs")
    .select("*")
    .eq("current_request_id", requestId)
    .maybeSingle();
  if (!job) return;

  if (!videoUrl) {
    await fail(job.id, job.user_id, job.credits_spent, errorMessage ?? "Étape échouée");
    return;
  }

  const target = job.target_seconds as number;
  const done = job.seconds_done as number;
  const parts = (job.parts as string[]) ?? [];

  try {
    switch (job.current_step as Step) {
      case "generate": {
        const first = Math.min(FIRST_MAX, target);
        parts.push(videoUrl);
        if (first >= target) {
          await supabaseAdmin
            .from("long_jobs")
            .update({ status: "done", final_url: videoUrl, parts, seconds_done: first, current_step: null, current_request_id: null, updated_at: new Date().toISOString() })
            .eq("id", job.id);
          return;
        }
        await setStep(job.id, "trim_tail", await trimTail(videoUrl, first), {
          parts,
          seconds_done: first,
          current_clip_url: videoUrl,
        });
        return;
      }
      case "trim_tail": {
        const newSec = Math.min(EXTEND_MAX, target - done);
        const requestId2 = await submit(MODEL.extend, {
          prompt: job.prompt,
          video_url: videoUrl,
          duration: newSec,
        });
        await setStep(job.id, "extend", requestId2, { current_clip_url: videoUrl });
        return;
      }
      case "extend": {
        const newSec = Math.min(EXTEND_MAX, target - done);
        const requestId2 = await submit(MODEL.trim, {
          video_url: videoUrl,
          start_time: TAIL,
          end_time: TAIL + newSec,
        });
        await setStep(job.id, "trim_new", requestId2);
        return;
      }
      case "trim_new": {
        const newSec = Math.min(EXTEND_MAX, target - done);
        parts.push(videoUrl);
        const total = done + newSec;
        if (total >= target) {
          const mergeId = await submit(MODEL.merge, { video_urls: parts });
          await setStep(job.id, "merge", mergeId, { parts, seconds_done: total });
          return;
        }
        await setStep(job.id, "trim_tail", await trimTail(videoUrl, newSec), {
          parts,
          seconds_done: total,
          current_clip_url: videoUrl,
        });
        return;
      }
      case "merge": {
        await supabaseAdmin
          .from("long_jobs")
          .update({ status: "done", final_url: videoUrl, current_step: null, current_request_id: null, updated_at: new Date().toISOString() })
          .eq("id", job.id);
        return;
      }
    }
  } catch (e) {
    await fail(job.id, job.user_id, job.credits_spent, e instanceof Error ? e.message : "Erreur d'étape");
  }
}

/** Lance la découpe des 2 dernières secondes d'un morceau de `length` secondes. */
async function trimTail(videoUrl: string, length: number): Promise<string> {
  return submit(MODEL.trim, {
    video_url: videoUrl,
    start_time: Math.max(0, length - TAIL),
    end_time: length,
  });
}
