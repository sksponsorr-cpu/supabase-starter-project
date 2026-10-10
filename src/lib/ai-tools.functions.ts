import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAILS } from "@/lib/owners";
import { kieCreditsToSamCredits } from "@/lib/ai-pricing";
import {
  AVATAR_MAX_SECONDS,
  CLONE_MAX_SECONDS,
  CLONE_MIN_SECONDS,
  jobCost,
  variantsFor,
  type AiTool,
} from "@/lib/ai-tools-pricing";

const GENERIC_ERROR = "Le service est momentanément indisponible. Réessayez dans un instant.";
const KIE_KEY = () => process.env.KIE_API_KEY ?? "";

type Db = {
  from: (table: string) => any;
  rpc: (fn: string, args: object) => Promise<{ data: any; error: any }>;
};

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

async function getDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

/** Marque la génération comme échouée et rembourse une seule fois. */
async function failAndRefund(
  db: Db,
  job: { id: string; user_id: string; cost_charged: number },
  reason: string,
) {
  const { data } = await db
    .from("ai_jobs")
    .update({ status: "failed", refunded: true, error: reason.slice(0, 300), updated_at: new Date().toISOString() })
    .eq("id", job.id)
    .eq("refunded", false)
    .select("id");
  if (data && data.length > 0) {
    await db.rpc("refund_ai_credits", {
      p_user: job.user_id,
      p_cost: Number(job.cost_charged),
      p_ref: `refund-${job.id}`,
    });
  }
}

/** Lien signé pour envoyer image, audio ou vidéo directement vers le stockage. */
export const presignAiUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        kind: z.enum(["image", "audio", "video"]),
        type: z.string().min(3).max(60),
        size: z.number().int().positive(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdminUser(context))) return { ok: false as const, message: "Fonctionnalité non disponible." };

    const limits = { image: 10, audio: 20, video: 100 } as const;
    if (!data.type.startsWith(`${data.kind}/`)) {
      return { ok: false as const, message: "Type de fichier non pris en charge." };
    }
    if (data.size > limits[data.kind] * 1024 * 1024) {
      return { ok: false as const, message: `Fichier trop volumineux (${limits[data.kind]} Mo maximum).` };
    }

    const r2 = await import("@/lib/r2.server");
    if (!r2.isR2Configured()) {
      console.error("[ai-tools] Cloudflare R2 non configuré");
      return { ok: false as const, message: GENERIC_ERROR };
    }

    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/wav": "wav",
      "audio/x-wav": "wav",
      "audio/mp4": "m4a",
      "audio/x-m4a": "m4a",
      "video/mp4": "mp4",
      "video/quicktime": "mov",
    };
    const ext = extMap[data.type];
    if (!ext) return { ok: false as const, message: "Format non pris en charge." };

    const { uploadUrl, publicUrl } = await r2.presignR2Put(`ai-tools/${context.userId}/${crypto.randomUUID()}.${ext}`);
    return { ok: true as const, uploadUrl, publicUrl };
  });

/** Lance une génération : débit, appel Kie.ai, enregistrement de la tâche. */
export const startAiJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tool: z.enum(["avatar", "clone"]),
        variant: z.string().min(1).max(30),
        imageUrl: z.string().url().max(500),
        mediaUrl: z.string().url().max(500),
        prompt: z.string().max(500).optional(),
        seconds: z.number().min(0.5).max(60),
        orientation: z.enum(["image", "video"]).default("image"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdminUser(context))) return { ok: false as const, message: "Fonctionnalité non disponible." };

    const tool = data.tool as AiTool;
    const variant = variantsFor(tool).find((v) => v.id === data.variant);
    if (!variant) return { ok: false as const, message: "Option non disponible." };

    if (tool === "avatar" && data.seconds > AVATAR_MAX_SECONDS) {
      return { ok: false as const, message: `L'audio est limité à ${AVATAR_MAX_SECONDS} secondes.` };
    }
    if (tool === "clone" && (data.seconds < CLONE_MIN_SECONDS || data.seconds > CLONE_MAX_SECONDS)) {
      return { ok: false as const, message: `La vidéo doit durer entre ${CLONE_MIN_SECONDS} et ${CLONE_MAX_SECONDS} secondes.` };
    }

    // Les fichiers doivent venir de notre propre stockage.
    const base = (process.env.CLOUDFLARE_R2_PUBLIC_URL ?? "").trim().replace(/\/+$/, "");
    if (!base || !data.imageUrl.startsWith(`${base}/`) || !data.mediaUrl.startsWith(`${base}/`)) {
      return { ok: false as const, message: "Fichier non valide. Réessayez l'envoi." };
    }

    if (!KIE_KEY()) {
      console.error("[ai-tools] KIE_API_KEY manquante côté serveur");
      return { ok: false as const, message: GENERIC_ERROR };
    }

    const db = await getDb();
    const cost = jobCost(variant, data.seconds);

    const { data: profile } = await db.from("profiles").select("credits_balance").eq("id", context.userId).maybeSingle();
    if (!profile || Number(profile.credits_balance) < Math.ceil(cost)) {
      return { ok: false as const, message: "Crédits insuffisants. Rechargez votre compte depuis Abonnement." };
    }

    const { data: inserted, error: insertError } = await db
      .from("ai_jobs")
      .insert({ user_id: context.userId, tool, variant: variant.id, seconds: data.seconds, cost_charged: cost })
      .select("id")
      .single();
    if (insertError || !inserted) {
      console.error("[ai-tools] insertion ai_jobs", insertError);
      return { ok: false as const, message: GENERIC_ERROR };
    }
    const jobId = inserted.id as string;

    const { data: debited, error: debitError } = await db.rpc("debit_ai_credits", {
      p_user: context.userId,
      p_cost: cost,
      p_ref: `ai-${tool}-${jobId}`,
    });
    if (debitError || debited !== true) {
      await db.from("ai_jobs").update({ status: "failed", refunded: true, error: "debit" }).eq("id", jobId);
      return { ok: false as const, message: "Crédits insuffisants. Rechargez votre compte depuis Abonnement." };
    }

    const input =
      tool === "avatar"
        ? { image_url: data.imageUrl, audio_url: data.mediaUrl, prompt: data.prompt ?? "" }
        : {
            prompt: data.prompt ?? "",
            input_urls: [data.imageUrl],
            video_urls: [data.mediaUrl],
            mode: variant.mode,
            character_orientation: data.orientation,
          };

    try {
      const res = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
        method: "POST",
        headers: { Authorization: `Bearer ${KIE_KEY()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: variant.model, input }),
      });
      const json = await res.json();
      const taskId = json?.data?.taskId as string | undefined;
      if (!res.ok || json.code !== 200 || !taskId) {
        console.error("[ai-tools] createTask", res.status, JSON.stringify(json).slice(0, 500));
        await failAndRefund(db, { id: jobId, user_id: context.userId, cost_charged: cost }, "createTask");
        return { ok: false as const, message: "La génération n'a pas pu démarrer. Vos crédits n'ont pas été débités." };
      }
      await db
        .from("ai_jobs")
        .update({ kie_task_id: taskId, status: "processing", updated_at: new Date().toISOString() })
        .eq("id", jobId);
    } catch (error) {
      console.error("[ai-tools] createTask impossible", error);
      await failAndRefund(db, { id: jobId, user_id: context.userId, cost_charged: cost }, "network");
      return { ok: false as const, message: "La génération n'a pas pu démarrer. Vos crédits n'ont pas été débités." };
    }

    return { ok: true as const, jobId, cost };
  });

/** Suit une génération : interroge Kie.ai, règle le coût réel, rembourse en cas d'échec. */
export const getAiJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isAdminUser(context))) return { ok: false as const, message: "Fonctionnalité non disponible." };
    const db = await getDb();

    const { data: job } = await db
      .from("ai_jobs")
      .select("id, user_id, kie_task_id, status, cost_charged, result_url, reconciled")
      .eq("id", data.jobId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!job) return { ok: false as const, message: "Génération introuvable." };

    if (job.status === "success") return { ok: true as const, status: "success" as const, resultUrl: job.result_url as string | null, progress: 100 };
    if (job.status === "failed") {
      return { ok: true as const, status: "failed" as const, resultUrl: null, progress: 0, message: "La génération a échoué. Vos crédits ont été remboursés." };
    }
    if (!job.kie_task_id) return { ok: true as const, status: "processing" as const, resultUrl: null, progress: 0 };

    try {
      const res = await fetch(
        `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(job.kie_task_id)}`,
        { headers: { Authorization: `Bearer ${KIE_KEY()}` } },
      );
      const json = await res.json();
      if (!res.ok || json.code !== 200 || !json.data) {
        return { ok: true as const, status: "processing" as const, resultUrl: null, progress: 0 };
      }
      const info = json.data as {
        state: string;
        resultJson?: string;
        failMsg?: string;
        progress?: number;
        creditsConsumed?: number;
      };

      if (info.state === "success") {
        let resultUrl: string | null = null;
        try {
          resultUrl = (JSON.parse(info.resultJson ?? "{}").resultUrls as string[] | undefined)?.[0] ?? null;
        } catch {
          resultUrl = null;
        }
        if (!resultUrl) {
          await failAndRefund(db, job, "no-result");
          return { ok: true as const, status: "failed" as const, resultUrl: null, progress: 0, message: "La génération a échoué. Vos crédits ont été remboursés." };
        }

        // Une seule exécution : on enregistre le résultat et on règle l'écart de coût.
        const { data: claimed } = await db
          .from("ai_jobs")
          .update({ status: "success", result_url: resultUrl, reconciled: true, updated_at: new Date().toISOString() })
          .eq("id", job.id)
          .eq("reconciled", false)
          .select("id");
        if (claimed && claimed.length > 0) {
          const actualKie = Number(info.creditsConsumed ?? 0);
          if (actualKie > 0) {
            const actual = Math.ceil(kieCreditsToSamCredits(actualKie) * 1000) / 1000;
            const diff = actual - Number(job.cost_charged);
            if (diff > 0.001) {
              await db.rpc("debit_ai_credits", { p_user: job.user_id, p_cost: diff, p_ref: `adjust-${job.id}` });
            } else if (diff < -0.001) {
              await db.rpc("refund_ai_credits", { p_user: job.user_id, p_cost: -diff, p_ref: `adjust-${job.id}` });
            }
          }
        }
        return { ok: true as const, status: "success" as const, resultUrl, progress: 100 };
      }

      if (info.state === "fail") {
        console.error("[ai-tools] tâche en échec", job.kie_task_id, info.failMsg);
        await failAndRefund(db, job, info.failMsg ?? "fail");
        return { ok: true as const, status: "failed" as const, resultUrl: null, progress: 0, message: "La génération a échoué. Vos crédits ont été remboursés." };
      }

      return { ok: true as const, status: "processing" as const, resultUrl: null, progress: Number(info.progress ?? 0) };
    } catch (error) {
      console.error("[ai-tools] suivi impossible", error);
      return { ok: true as const, status: "processing" as const, resultUrl: null, progress: 0 };
    }
  });

/** Dernières générations de l'utilisateur pour un outil. */
export const listAiJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ tool: z.enum(["avatar", "clone"]) }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isAdminUser(context))) return [] as AiJobRow[];
    const db = await getDb();
    const { data: rows } = await db
      .from("ai_jobs")
      .select("id, status, seconds, cost_charged, result_url, created_at")
      .eq("user_id", context.userId)
      .eq("tool", data.tool)
      .order("created_at", { ascending: false })
      .limit(10);
    return ((rows ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      status: String(r.status),
      seconds: Number(r.seconds),
      cost: Number(r.cost_charged),
      resultUrl: (r.result_url as string | null) ?? null,
      createdAt: String(r.created_at),
    })) as AiJobRow[];
  });

export type AiJobRow = {
  id: string;
  status: string;
  seconds: number;
  cost: number;
  resultUrl: string | null;
  createdAt: string;
};
