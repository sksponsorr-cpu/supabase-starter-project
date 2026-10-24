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

/** Retire des crédits à un utilisateur (solde jamais négatif). Motif obligatoire, trace conservée. */
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
    const { data: prof, error: readErr } = await db
      .from("profiles")
      .select("credits_balance")
      .eq("id", data.userId)
      .maybeSingle();
    if (readErr || !prof) return { ok: false, message: "Utilisateur introuvable." };
    const before = Number(prof.credits_balance ?? 0);
    const removed = Math.min(before, data.amount);
    const after = before - removed;
    const { error: upErr } = await db.from("profiles").update({ credits_balance: after }).eq("id", data.userId);
    if (upErr) return { ok: false, message: "Impossible de mettre à jour le solde." };
    // Trace : best effort, n'empêche pas le retrait.
    await db
      .from("credit_ledger")
      .insert({ user_id: data.userId, kind: "admin_retrait", amount: -removed, reason: data.reason })
      .then(() => null, () => null);
    return {
      ok: true,
      message: removed < data.amount
        ? `${removed} crédits retirés (solde insuffisant, le solde est maintenant à 0).`
        : `${removed} crédits retirés. Nouveau solde : ${after}.`,
    };
  });
