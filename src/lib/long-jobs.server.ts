import { clipMaxSeconds } from "@/lib/plans";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { creditCostFor, type Resolution } from "@/lib/credits";
import { getCreditConfig } from "@/lib/credits.server";
import { activePlan } from "@/lib/services/access.server";
import { getGrokVideoTask } from "@/lib/services/kie-video.server";

/**
 * Vidéos longues, entièrement sur Kie.ai.
 * Étapes : génération de base (grok-imagine/text-to-video), puis prolongations successives
 * (grok-imagine/extend) à partir de la tâche précédente, jusqu'à la durée demandée.
 * Chaque étape terminée est notifiée par callBackUrl (voir routes/api/public/webhooks/kie.ts),
 * et vérifiée auprès de Kie.ai avant d'enchaîner la suivante.
 */

const KIE_JOBS = "https://api.kie.ai/api/v1/jobs";
const MODEL = {
  first: "grok-imagine/text-to-video",
  extend: "grok-imagine/extend",
} as const;

const FIRST_MAX = 30; // secondes max de la génération de base (Grok accepte 30 s en une seule génération)
const EXTEND_MAX = 10; // secondes max ajoutées à chaque prolongation

type Step = "generate" | "extend";

function kieKey(): string {
  const key = process.env["KIE_API_KEY"];
  if (!key) throw new Error("KIE_API_KEY manquante");
  return key;
}

function callbackUrl(): string {
  const base = process.env["PUBLIC_APP_URL"] ?? "";
  const secret = process.env["KIE_WEBHOOK_SECRET"];
  if (!secret) throw new Error("KIE_WEBHOOK_SECRET manquante");
  return `${base.replace(/\/$/, "")}/api/public/webhooks/kie?s=${encodeURIComponent(secret)}`;
}

/** Crée une tâche Kie.ai et renvoie son identifiant. */
async function createTask(model: string, input: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${KIE_JOBS}/createTask`, {
    method: "POST",
    headers: { Authorization: `Bearer ${kieKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, callBackUrl: callbackUrl(), input }),
  });
  const json = (await res.json().catch(() => ({}))) as { code?: number; msg?: string; data?: { taskId?: string } };
  if (!res.ok || json.code !== 200 || !json.data?.taskId) {
    throw new Error(`kie createTask ${res.status}: ${json.msg ?? "réponse inattendue"}`);
  }
  return json.data.taskId;
}

function resolutionParam(resolution: string): string {
  return resolution.toLowerCase();
}

async function setJob(jobId: string, fields: Record<string, unknown>) {
  await supabaseAdmin
    .from("long_jobs")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", jobId);
}

/** Message affiché au client. Le détail technique reste dans les journaux serveur. */
function friendlyJobError(raw: string): string {
  console.error("[long-job]", raw);
  if (/timeout|timed out|délai/i.test(raw)) return "La génération a pris trop de temps. Tes crédits ont été rendus.";
  if (/nsfw|content|safety|policy|moderat|modér/i.test(raw)) return "Le contenu n'a pas pu être généré. Reformule ta description. Tes crédits ont été rendus.";
  return "La génération a échoué. Tes crédits ont été rendus.";
}

async function fail(jobId: string, userId: string, creditsSpent: number, rawMessage: string) {
  await setJob(jobId, { status: "failed", error_message: friendlyJobError(rawMessage) });
  // Remboursement, même logique que les générations.
  await supabaseAdmin.rpc("add_credits", {
    p_user: userId,
    p_amount: creditsSpent,
    p_kind: "remboursement",
    p_ref: `long-job-${jobId}`,
  });
}

/** Lance une vidéo longue : débite les crédits, crée la ligne, lance la génération de base. */
export async function startLongJob(input: {
  userId: string;
  prompt: string;
  resolution: Resolution;
  seconds: number;
  modelId?: string | null;
}): Promise<{ ok: true; jobId: string } | { ok: false; message: string }> {
  // Vérification serveur (le curseur côté interface ne suffit pas) :
  // sans abonnement 60 s maximum, avec un abonnement 180 s maximum.
  const { plan } = await activePlan(input.userId);
  const maxSeconds = clipMaxSeconds(plan);
  if (input.seconds > maxSeconds) {
    return {
      ok: false,
      message: plan === "free"
        ? "Sans abonnement, la durée est limitée à 1 minute. Passez à un abonnement pour aller plus loin."
        : "La durée maximale est de 3 minutes.",
    };
  }

  const config = await getCreditConfig();
  // Même prix que celui affiché dans l'interface : prix du modèle choisi si tarifé, sinon prix générique.
  const { isPricedModel, generationCreditsFor } = await import("@/lib/creator-pricing");
  const modelCost = isPricedModel(input.modelId ?? null)
    ? generationCreditsFor(input.modelId as never, input.resolution as never, input.seconds)
    : null;
  const cost = modelCost ?? creditCostFor("video", input.seconds, input.resolution, config);

  const { data: spent, error: spendError } = await supabaseAdmin.rpc("spend_credits", {
    p_user: input.userId,
    p_amount: cost,
    p_ref: crypto.randomUUID(),
  });
  if (spendError) return { ok: false, message: spendError.message };
  if (!spent) {
    const { data: wallet } = await supabaseAdmin
      .from("profiles")
      .select("credits_balance")
      .eq("id", input.userId)
      .maybeSingle();
    return {
      ok: false,
      message: `Crédits insuffisants : cette création coûte ${cost} crédits, ton solde est de ${wallet?.credits_balance ?? 0} crédits.`,
    };
  }

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
    const taskId = await createTask(MODEL.first, {
      prompt: input.prompt.slice(0, 4096),
      aspect_ratio: "16:9",
      mode: "normal",
      duration: String(first),
      resolution: resolutionParam(input.resolution),
    });
    await setJob(row.id, {
      current_step: "generate" satisfies Step,
      current_request_id: taskId,
      seconds_done: first,
    });
    return { ok: true, jobId: row.id };
  } catch (e) {
    await fail(row.id, input.userId, cost, e instanceof Error ? e.message : "Erreur de lancement");
    return { ok: false, message: "Le lancement a échoué. Vos crédits ont été rendus." };
  }
}

/**
 * Une tâche est terminée côté Kie.ai (résultat vérifié, pas celui du corps de la requête).
 * On passe à la prolongation suivante, ou on livre la vidéo si la durée est atteinte.
 */
export async function handleStepResult(requestId: string, videoUrl: string | null, errorMessage?: string) {
  const { data: job } = await supabaseAdmin
    .from("long_jobs")
    .select("*")
    .eq("current_request_id", requestId)
    .maybeSingle();
  if (!job || job.status !== "running") return;

  if (!videoUrl) {
    await fail(job.id, job.user_id, job.credits_spent, errorMessage ?? "Étape échouée");
    return;
  }

  const target = job.target_seconds as number;
  const total = job.seconds_done as number;

  try {
    if (total >= target) {
      await setJob(job.id, { status: "done", final_url: videoUrl, current_step: null, current_request_id: null });
      return;
    }
    const next = Math.min(EXTEND_MAX, target - total);
    const taskId = await createTask(MODEL.extend, {
      task_id: requestId,
      prompt: job.prompt,
      extend_at: total,
      extend_times: String(next),
    });
    await setJob(job.id, {
      current_step: "extend" satisfies Step,
      current_request_id: taskId,
      seconds_done: total + next,
      final_url: videoUrl,
    });
  } catch (e) {
    await fail(job.id, job.user_id, job.credits_spent, e instanceof Error ? e.message : "Erreur d'étape");
  }
}

/** Appelé par le webhook Kie.ai : on relit l'état de la tâche avant de faire quoi que ce soit. */
export async function handleTaskCallback(taskId: string) {
  const r = await getGrokVideoTask(taskId);
  if (!r.ok) return; // Suivi indisponible : la reprise périodique réessaiera.
  if (r.state === "success") return handleStepResult(taskId, r.resultUrl);
  if (r.state === "fail") return handleStepResult(taskId, null, r.failMsg ?? "Échec côté fournisseur");
}

/**
 * Reprend les vidéos restées en cours (callback perdu ou interrompu) en interrogeant Kie.ai.
 * Une étape terminée est enchaînée ; une étape en échec est remboursée une seule fois.
 */
export async function recoverStuckLongJobs(): Promise<{ checked: number; resumed: number; failed: number; pending: number }> {
  const cutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  const { data: jobs } = await supabaseAdmin
    .from("long_jobs")
    .select("id, current_step, current_request_id")
    .eq("status", "running")
    .not("current_request_id", "is", null)
    .lt("updated_at", cutoff)
    .limit(50);

  const out = { checked: 0, resumed: 0, failed: 0, pending: 0 };
  for (const job of (jobs ?? []) as { id: string; current_step: string | null; current_request_id: string }[]) {
    out.checked++;
    // Les jobs lancés avant la migration vers Kie.ai (étapes fal.ai) ne peuvent pas être repris ici.
    if (job.current_step !== "generate" && job.current_step !== "extend") {
      out.pending++;
      continue;
    }
    const r = await getGrokVideoTask(job.current_request_id);
    if (!r.ok || r.state === "waiting") {
      out.pending++;
      continue;
    }
    if (r.state === "success" && r.resultUrl) {
      await handleStepResult(job.current_request_id, r.resultUrl);
      out.resumed++;
    } else {
      await handleStepResult(job.current_request_id, null, r.failMsg ?? "Échec côté fournisseur");
      out.failed++;
    }
  }
  return out;
}
