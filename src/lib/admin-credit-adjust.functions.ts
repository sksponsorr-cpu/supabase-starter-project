import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Même règle que le bureau administrateur : e-mail propriétaire, ou rôle admin. */
async function assertAdmin(context: { userId: string; claims?: unknown; supabase: unknown }) {
  const { isOwnerEmail } = await import("@/lib/owners");
  const claims = context.claims as { email?: unknown } | null;
  const email = typeof claims?.email === "string" ? claims.email : null;
  if (!isOwnerEmail(email)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data, error } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || data !== true) throw new Error("Accès refusé");
  }
}

/**
 * Retire des crédits à un utilisateur. Passe par la fonction SQL admin_remove_credits,
 * qui consomme les lots de crédits (credit_grants) et met le solde à jour dans la même opération.
 */
export const adminRemoveCredits = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        amount: z.number().int().min(1).max(100000),
        reason: z.string().trim().min(3).max(200),
      })
      .parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;

    const { data: removedRaw, error: rpcErr } = await db.rpc("admin_remove_credits", {
      p_user: data.userId,
      p_amount: data.amount,
      p_reason: data.reason,
    });
    if (rpcErr) return { ok: false, message: "Impossible de retirer les crédits." };

    const removed = Number(removedRaw ?? 0);
    const { data: after } = await db.rpc("spendable_credits", { p_user: data.userId });
    const remaining = Number(after ?? 0);

    return {
      ok: true,
      message: removed < data.amount
        ? `${removed} crédits retirés (solde insuffisant). Nouveau solde : ${remaining}.`
        : `${removed} crédits retirés. Nouveau solde : ${remaining}.`,
    };
  });
