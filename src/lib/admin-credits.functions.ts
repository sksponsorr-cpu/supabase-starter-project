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


/** Prévient l'utilisateur par e-mail (Brevo). Retourne true si l'e-mail est parti. */
async function notifyUserByEmail(userId: string, subject: string, messageBody: string): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabaseAdmin as any).from("profiles").select("email").eq("id", userId).maybeSingle();
    const email = (profile as { email?: string | null } | null)?.email;
    if (!email) return false;
    const { sendAdminDirectEmail } = await import("@/lib/services/brevo.server");
    const res = await sendAdminDirectEmail({ toEmail: email, subject, messageBody });
    if (!res.ok) console.error("[ADMIN] E-mail non envoyé:", res.error);
    return res.ok;
  } catch (e) {
    console.error("[ADMIN] Erreur e-mail:", e);
    return false;
  }
}

export type CreditUserInfo = {
  id: string;
  email: string;
  name: string | null;
  balance: number;
  plan: string;
  planEndsAt: string | null;
  history: { delta: number; kind: string; at: string; balanceAfter: number | null }[];
};

async function loadUserInfo(userId: string): Promise<CreditUserInfo | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as AnyClient;
  const { data: p } = await db.from("profiles").select("id, email, full_name, credits_balance").eq("id", userId).maybeSingle();
  if (!p) return null;
  const { data: sub } = await db
    .from("subscriptions")
    .select("plan_type, status, is_active, ends_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: ledger } = await db
    .from("credit_ledger")
    .select("delta, kind, created_at, balance_after")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(8);
  const active = !!sub && sub.is_active !== false && sub.status === "active" && (!sub.ends_at || new Date(sub.ends_at) > new Date());
  return {
    id: p.id as string,
    email: (p.email as string | null) ?? "",
    name: (p.full_name as string | null) ?? null,
    balance: Number(p.credits_balance ?? 0),
    plan: active ? String(sub.plan_type ?? "abonnement") : "Gratuit (aucun abonnement actif)",
    planEndsAt: active ? ((sub.ends_at as string | null) ?? null) : null,
    history: ((ledger ?? []) as { delta: number; kind: string; created_at: string; balance_after: number | null }[]).map((r) => ({
      delta: Number(r.delta),
      kind: r.kind,
      at: r.created_at,
      balanceAfter: r.balance_after === null ? null : Number(r.balance_after),
    })),
  };
}

/** Retrouve un utilisateur par e-mail ; renvoie aussi son solde, son offre et ses derniers mouvements de crédits. */
export const adminFindUserByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email?: string; userId?: string }) =>
    z.object({ email: z.string().trim().email().max(200).optional(), userId: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertAdmin(context as any);
    let id = data.userId ?? null;
    if (!id && data.email) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = supabaseAdmin as unknown as AnyClient;
      const { data: rows } = await db.from("profiles").select("id").eq("email", data.email.toLowerCase()).limit(1);
      id = (rows?.[0]?.id as string | undefined) ?? null;
    }
    if (!id) return { ok: false as const, message: "Aucun compte avec cet e-mail." };
    const info = await loadUserInfo(id);
    if (!info) return { ok: false as const, message: "Compte introuvable." };
    return { ok: true as const, user: info };
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
    const sent = await notifyUserByEmail(
      data.userId,
      `${data.credits} crédits ajoutés à votre compte Sam Flash`,
      `Bonne nouvelle ! ${data.credits} crédits viennent d'être ajoutés à votre compte Sam Flash 2.0.\n\nVous pouvez dès maintenant les utiliser pour créer vos images et vos vidéos.`,
    );
    return { ok: true as const, message: `${data.credits} crédits ajoutés.${sent ? " E-mail envoyé." : " (E-mail non envoyé.)"}` };
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
    const sent = await notifyUserByEmail(
      data.userId,
      "Votre abonnement Sam Flash sur mesure est actif",
      `Votre abonnement Sam Flash sur mesure est actif jusqu'au ${endsAt.toLocaleDateString("fr-FR")}.\n\n${data.credits} crédits ont été ajoutés à votre compte.`,
    );
    return {
      ok: true as const,
      message: `Sur mesure activé jusqu'au ${endsAt.toLocaleDateString("fr-FR")} · ${data.credits} crédits ajoutés.${sent ? " E-mail envoyé." : " (E-mail non envoyé.)"}`,
    };
  });
