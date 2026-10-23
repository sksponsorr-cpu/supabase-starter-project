import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAILS } from "@/lib/owners";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (t: string) => any };

async function assertAdmin(context: {
  userId: string;
  claims?: unknown;
  supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: boolean | null; error: unknown }> };
}) {
  const claims = context.claims as { email?: unknown } | null;
  const email = typeof claims?.email === "string" ? claims.email.toLowerCase().trim() : "";
  if (email && OWNER_EMAILS.includes(email)) return;
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || data !== true) throw new Error("Accès refusé");
}

/** Retrouve un utilisateur par son e-mail. */
export const adminFindUserByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) => z.object({ email: z.string().trim().email().max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as AnyClient;
    const { data: rows } = await db
      .from("profiles")
      .select("id, email, full_name")
      .eq("email", data.email.toLowerCase())
      .limit(1);
    const row = rows?.[0] as { id: string; email: string | null; full_name: string | null } | undefined;
    if (!row) return { ok: false as const, message: "Aucun compte avec cet e-mail." };
    return { ok: true as const, user: { id: row.id, email: row.email ?? data.email, name: row.full_name ?? null } };
  });

/** Ajoute un nombre libre de crédits (+5, +10, +20...) à un utilisateur. */
export const adminAddCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; credits: number; reason: string }) =>
    z
      .object({
        userId: z.string().uuid(),
        credits: z.number().int().min(1).max(1000000),
        reason: z.string().trim().min(3, "Motif obligatoire (3 caractères minimum)").max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("add_credits", {
      p_user: data.userId,
      p_amount: data.credits,
      p_kind: "recharge",
      p_ref: crypto.randomUUID(),
    });
    if (error) return { ok: false as const, message: "L'ajout des crédits a échoué." };
    try {
      await supabaseAdmin.from("admin_actions").insert({
        admin_id: context.userId,
        target_user_id: data.userId,
        action: "add_credits",
        details: { credits_granted: data.credits, reason: data.reason },
      });
    } catch (e) {
      console.error("[ADMIN] log add_credits:", e);
    }
    return { ok: true as const, message: `${data.credits} crédits ajoutés.` };
  });

/** Abonnement « Sur mesure » : crédits choisis + durée en mois. */
export const adminGrantCustomPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; credits: number; months: number; reason: string }) =>
    z
      .object({
        userId: z.string().uuid(),
        credits: z.number().int().min(1).max(1000000),
        months: z.number().int().min(1).max(24),
        reason: z.string().trim().min(3, "Motif obligatoire (3 caractères minimum)").max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as AnyClient;

    const { data: price } = await db.from("product_prices").select("tier").eq("id", "custom").maybeSingle();
    const tier = (price?.tier as string | undefined) ?? "super_grok";

    const endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + data.months);
    const row = {
      tier,
      plan_type: "sam_flash_custom",
      status: "active",
      is_active: true,
      started_at: new Date().toISOString(),
      ends_at: endsAt.toISOString(),
    };

    const { data: existing } = await db.from("subscriptions").select("id").eq("user_id", data.userId).maybeSingle();
    const { error: subError } = existing
      ? await db.from("subscriptions").update(row).eq("id", existing.id)
      : await db.from("subscriptions").insert({ user_id: data.userId, ...row });
    if (subError) return { ok: false as const, message: "Activation de l'abonnement impossible." };

    const { error: creditError } = await supabaseAdmin.rpc("add_credits", {
      p_user: data.userId,
      p_amount: data.credits,
      p_kind: "abonnement",
      p_ref: crypto.randomUUID(),
    });
    if (creditError) return { ok: false as const, message: "Abonnement activé, mais l'ajout des crédits a échoué." };

    try {
      await supabaseAdmin.from("admin_actions").insert({
        admin_id: context.userId,
        target_user_id: data.userId,
        action: "add_subscription",
        details: { plan: "sam_flash_custom", tier, credits_granted: data.credits, months: data.months, reason: data.reason },
      });
    } catch (e) {
      console.error("[ADMIN] log custom plan:", e);
    }
    return {
      ok: true as const,
      message: `Sur mesure activé jusqu'au ${endsAt.toLocaleDateString("fr-FR")} · ${data.credits} crédits ajoutés.`,
    };
  });
