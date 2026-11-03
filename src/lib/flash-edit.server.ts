import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isPlatformOwner } from "@/lib/owner-guard.server";
import { wan30Credits, type ResolutionWan } from "@/lib/pricing/video-edit-pricing";
import { storeFinalMedia } from "@/lib/services/generation.server";
import { getGrokVideoTask } from "@/lib/services/kie-video.server";

/** Tant que cette valeur est false, seuls les propriétaires de la plateforme peuvent lancer Flash Edit. */
export const FLASH_EDIT_OPEN = true;

const KIE_JOBS = "https://api.kie.ai/api/v1/jobs";
/** Modèle fournisseur : interne au serveur, jamais affiché. */
const PROVIDER_MODEL = "wan/3-0-video";
const MAX_SOURCE_SECONDS = 15;
const MAX_TOTAL_SECONDS = 30;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any;

type StartInput = {
  userId: string;
  sourceUrl: string;
  sourceSeconds: number;
  outputSeconds: number;
  resolution: ResolutionWan;
  prompt: string;
  audio: boolean;
};

function kieKey(): string {
  const key = process.env["KIE_API_KEY"];
  if (!key) throw new Error("KIE_API_KEY manquante");
  return key;
}

function callbackUrl(): string {
  const base = (process.env["PUBLIC_APP_URL"] ?? "").replace(/\/$/, "");
  const secret = process.env["KIE_WEBHOOK_SECRET"];
  if (!secret) throw new Error("variable KIE_WEBHOOK_SECRET absente sur le serveur");
  if (!/^https:\/\//.test(base)) throw new Error("variable PUBLIC_APP_URL absente ou sans https://");
  return `${base}/api/public/webhooks/kie?s=${encodeURIComponent(secret)}`;
}

async function refund(userId: string, amount: number, ref: string) {
  await supabaseAdmin.rpc("add_credits", { p_user: userId, p_amount: amount, p_kind: "remboursement", p_ref: ref });
}

/** Passe la tâche en échec une seule fois, puis rembourse une seule fois. */
async function failJob(jobId: string, userId: string, cost: number, message: string) {
  const { data } = await db
    .from("flash_edit_jobs")
    .update({ status: "failed", error_message: message, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", "running")
    .select("id");
  if (data?.length) await refund(userId, cost, `flash-${jobId}`);
}

export async function startFlashEdit(
  input: StartInput,
): Promise<{ ok: true; jobId: string } | { ok: false; message: string }> {
  if (!FLASH_EDIT_OPEN && !(await isPlatformOwner(input.userId))) {
    return { ok: false, message: "Cet outil n'est pas encore ouvert." };
  }
  if (!Number.isInteger(input.sourceSeconds) || input.sourceSeconds < 1 || input.sourceSeconds > MAX_SOURCE_SECONDS) {
    return { ok: false, message: `La vidéo source ne doit pas dépasser ${MAX_SOURCE_SECONDS} secondes.` };
  }
  if (!Number.isInteger(input.outputSeconds) || input.outputSeconds < 2 || input.outputSeconds > MAX_TOTAL_SECONDS - input.sourceSeconds) {
    return { ok: false, message: "La vidéo source plus le résultat ne peuvent pas dépasser 30 secondes." };
  }

  let cost: number;
  try {
    cost = wan30Credits({ outputSeconds: input.outputSeconds, inputVideoSeconds: input.sourceSeconds, resolution: input.resolution });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Paramètres invalides." };
  }

  const { data: spent, error: spendError } = await supabaseAdmin.rpc("spend_credits", {
    p_user: input.userId,
    p_amount: cost,
    p_ref: crypto.randomUUID(),
  });
  if (spendError) return { ok: false, message: "Crédits indisponibles. Réessaie." };
  if (!spent) return { ok: false, message: `Crédits insuffisants : cette modification coûte ${cost} crédits.` };

  const { data: row, error } = await db
    .from("flash_edit_jobs")
    .insert({
      user_id: input.userId,
      status: "running",
      prompt: input.prompt,
      source_url: input.sourceUrl,
      source_seconds: input.sourceSeconds,
      output_seconds: input.outputSeconds,
      resolution: input.resolution,
      audio: input.audio,
      cost_credits: cost,
    })
    .select("id")
    .single();
  if (error || !row) {
    await refund(input.userId, cost, `flash-setup-${crypto.randomUUID()}`);
    return { ok: false, message: "Création impossible. Tes crédits ont été rendus." };
  }

  try {
    const res = await fetch(`${KIE_JOBS}/createTask`, {
      method: "POST",
      headers: { Authorization: `Bearer ${kieKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: PROVIDER_MODEL,
        callBackUrl: callbackUrl(),
        input: {
          prompt: `Based on Video1: ${input.prompt}`.slice(0, 20000),
          reference_video_urls: [input.sourceUrl],
          resolution: input.resolution,
          aspect_ratio: "adaptive",
          duration: input.outputSeconds,
          audio: input.audio,
          nsfw_checker: true,
        },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { code?: number; data?: { taskId?: string } };
    const taskId = json.data?.taskId;
    if (!res.ok || json.code !== 200 || !taskId) {
      const detail = (json as { msg?: string }).msg ?? "réponse sans détail";
      throw new Error(`fournisseur ${json.code ?? res.status} : ${detail}`);
    }
    await db
      .from("flash_edit_jobs")
      .update({ provider_task_id: taskId, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    return { ok: true, jobId: row.id };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "erreur inconnue";
    console.error("[flash-edit] createTask", reason);
    const message = `La création a échoué (${reason.slice(0, 120)}). Tes crédits ont été rendus.`;
    await failJob(row.id, input.userId, cost, message);
    return { ok: false, message };
  }
}

/**
 * Callback du fournisseur. Retourne false si la tâche n'appartient pas à Flash Edit,
 * pour laisser le webhook traiter les vidéos longues.
 */
export async function handleFlashEditCallback(taskId: string): Promise<boolean> {
  const { data: job } = await db
    .from("flash_edit_jobs")
    .select("id, user_id, cost_credits, status")
    .eq("provider_task_id", taskId)
    .maybeSingle();
  if (!job) return false;
  if (job.status !== "running") return true;

  const r = await getGrokVideoTask(taskId);
  if (!r.ok || r.state === "waiting") return true;
  const cost = Number(job.cost_credits);

  if (r.state === "fail") {
    await failJob(job.id, job.user_id, cost, "La modification n'a pas abouti. Tes crédits ont été rendus.");
    return true;
  }

  let resultUrl: string | null = r.resultUrl;
  let resultPath: string | null = null;
  if (resultUrl) {
    try {
      const res = await fetch(resultUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const stored = await storeFinalMedia(job.user_id, bytes, res.headers.get("content-type") ?? "video/mp4");
      resultUrl = stored.mediaUrl;
      resultPath = stored.storagePath;
    } catch (e) {
      console.error("[flash-edit] copie impossible, URL fournisseur conservée", e);
    }
  }
  await db
    .from("flash_edit_jobs")
    .update({ status: "done", result_url: resultUrl, result_path: resultPath, updated_at: new Date().toISOString() })
    .eq("id", job.id)
    .eq("status", "running");
  return true;
}
