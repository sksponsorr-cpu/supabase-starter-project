import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Vidéos non livrées (en attente ou en échec) : réservé au propriétaire de la plateforme. */

export const listLostGenerations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { isPlatformOwner } = await import("@/lib/owner-guard.server");
    if (!(await isPlatformOwner(context.userId))) return { ok: false as const, rows: [] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabaseAdmin
      .from("generations")
      .select("id, user_id, prompt, media_type, duration, status, error_message, provider_task_id, created_at")
      .eq("media_type", "video")
      .in("status", ["pending", "error"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);
    const rows = (data ?? []).map((r: Record<string, unknown>) => ({
      ...r,
      // Le message brut peut contenir l'identifiant de tâche : on ne l'expose pas.
      error_message: typeof r.error_message === "string" && r.error_message.startsWith("fal:") ? "En attente chez le fournisseur" : r.error_message,
      recoverable: Boolean(r.provider_task_id) || r.status === "pending",
    }));
    return { ok: true as const, rows: rows as Record<string, unknown>[] };
  });

export const recoverLostGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { isPlatformOwner } = await import("@/lib/owner-guard.server");
    if (!(await isPlatformOwner(context.userId))) return { ok: false as const, outcome: null, message: "Accès réservé." };
    const { recoverGenerationById } = await import("@/lib/services/generation.server");
    const r = await recoverGenerationById(data.id);
    if (!r.ok) return { ok: false as const, outcome: null, message: r.message };
    return { ok: true as const, outcome: r.outcome, message: r.message };
  });
