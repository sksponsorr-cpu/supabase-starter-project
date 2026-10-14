import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Db = {
  from: (table: string) => any;
  rpc: (fn: string, args: object) => Promise<{ data: any; error: any }>;
};

async function getDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

/**
 * Annule une génération en cours. La tâche chez le fournisseur continue jusqu'au bout,
 * mais son résultat est ignoré et les crédits sont remboursés une seule fois.
 */
export const cancelAiJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await getDb();
    const { data: job } = await db
      .from("ai_jobs")
      .select("id, user_id, status, cost_charged")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!job || job.user_id !== context.userId) {
      return { ok: false as const, message: "Génération introuvable." };
    }
    if (job.status !== "pending" && job.status !== "processing") {
      return { ok: false as const, message: "Cette génération est déjà terminée." };
    }
    const { data: updated } = await db
      .from("ai_jobs")
      .update({
        status: "failed",
        refunded: true,
        error: "Annulée par l'utilisateur",
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("refunded", false)
      .select("id");
    if (updated && updated.length > 0) {
      await db.rpc("refund_ai_credits", {
        p_user: job.user_id,
        p_cost: Number(job.cost_charged),
        p_ref: `refund-${job.id}`,
      });
    }
    return { ok: true as const };
  });

/** Supprime une génération terminée (réussie ou échouée) de la liste de l'utilisateur. */
export const deleteAiJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await getDb();
    const { data: job } = await db
      .from("ai_jobs")
      .select("id, user_id, status")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!job || job.user_id !== context.userId) {
      return { ok: false as const, message: "Génération introuvable." };
    }
    if (job.status === "pending" || job.status === "processing") {
      return { ok: false as const, message: "Annulez d'abord la génération en cours." };
    }
    await db.from("ai_jobs").delete().eq("id", job.id).eq("user_id", context.userId);
    return { ok: true as const };
  });
