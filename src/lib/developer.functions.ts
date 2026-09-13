import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type DeveloperEarning = {
  id: string;
  amount_eur: number;
  created_at: string;
};

export type PayoutRequest = {
  id: string;
  developer_id: string;
  amount_eur: number;
  method: string;
  mobile: string | null;
  note: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
  developer_email?: string | null;
  developer_name?: string | null;
};

export type DeveloperDashboard = {
  isDeveloper: boolean;
  totalEarned: number;
  totalPaid: number;
  pending: number;
  balance: number;
  earnings: DeveloperEarning[];
  payouts: PayoutRequest[];
};

async function isAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  return data === true;
}

/** Solde, historique des commissions et demandes de retrait du développeur connecté. */
export const getDeveloperDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DeveloperDashboard> => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isDeveloper = (roles ?? []).some((r: { role: string }) => r.role === "developer");

    const empty: DeveloperDashboard = {
      isDeveloper,
      totalEarned: 0,
      totalPaid: 0,
      pending: 0,
      balance: 0,
      earnings: [],
      payouts: [],
    };
    if (!isDeveloper) return empty;

    const [{ data: earnings }, { data: payouts }] = await Promise.all([
      context.supabase
        .from("developer_earnings")
        .select("id, amount_eur, created_at")
        .eq("developer_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(200),
      context.supabase
        .from("payout_requests")
        .select("id, developer_id, amount_eur, method, mobile, note, status, admin_note, created_at, processed_at")
        .eq("developer_id", context.userId)
        .order("created_at", { ascending: false }),
    ]);

    const list = (earnings ?? []) as DeveloperEarning[];
    const reqs = (payouts ?? []) as PayoutRequest[];
    const totalEarned = list.reduce((s, e) => s + Number(e.amount_eur ?? 0), 0);
    const totalPaid = reqs
      .filter((p) => p.status === "payee")
      .reduce((s, p) => s + Number(p.amount_eur ?? 0), 0);
    const pending = reqs
      .filter((p) => p.status === "en_attente")
      .reduce((s, p) => s + Number(p.amount_eur ?? 0), 0);

    return {
      isDeveloper,
      totalEarned: Math.round(totalEarned * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      pending: Math.round(pending * 100) / 100,
      balance: Math.round((totalEarned - totalPaid - pending) * 100) / 100,
      earnings: list,
      payouts: reqs,
    };
  });

/** Le développeur demande le versement d'une partie de son solde. */
export const requestPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        amountEur: z.number().positive().max(100000),
        method: z.string().min(2).max(40).default("mobile_money"),
        mobile: z.string().min(6).max(25),
        note: z.string().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!(roles ?? []).some((r: { role: string }) => r.role === "developer"))
      return { ok: false as const, message: "Accès réservé aux développeurs." };

    const [{ data: earnings }, { data: payouts }] = await Promise.all([
      context.supabase.from("developer_earnings").select("amount_eur").eq("developer_id", context.userId),
      context.supabase
        .from("payout_requests")
        .select("amount_eur, status")
        .eq("developer_id", context.userId),
    ]);
    const earned = (earnings ?? []).reduce((s: number, e: { amount_eur: number }) => s + Number(e.amount_eur ?? 0), 0);
    const used = (payouts ?? [])
      .filter((p: { status: string }) => p.status === "en_attente" || p.status === "payee")
      .reduce((s: number, p: { amount_eur: number }) => s + Number(p.amount_eur ?? 0), 0);
    const balance = Math.round((earned - used) * 100) / 100;

    if (data.amountEur > balance)
      return { ok: false as const, message: `Solde insuffisant (${balance} €).` };

    const { error } = await context.supabase.from("payout_requests").insert({
      developer_id: context.userId,
      amount_eur: data.amountEur,
      method: data.method,
      mobile: data.mobile,
      note: data.note ?? null,
    });
    if (error) return { ok: false as const, message: "Demande impossible." };
    return { ok: true as const, message: "Demande envoyée à l'administrateur." };
  });

/** Administration : toutes les demandes de retrait. */
export const listPayoutRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PayoutRequest[]> => {
    if (!(await isAdmin(context))) throw new Error("Accès refusé");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: reqs }, { data: profiles }] = await Promise.all([
      supabaseAdmin
        .from("payout_requests")
        .select("id, developer_id, amount_eur, method, mobile, note, status, admin_note, created_at, processed_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("id, email, full_name"),
    ]);
    return ((reqs ?? []) as PayoutRequest[]).map((r) => {
      const p = (profiles ?? []).find((x) => x.id === r.developer_id);
      return { ...r, developer_email: p?.email ?? null, developer_name: p?.full_name ?? null };
    });
  });

/** Administration : accepter, refuser ou marquer une demande comme payée. */
export const decidePayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["payee", "refusee", "en_attente"]),
        adminNote: z.string().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) return { ok: false as const, message: "Accès refusé." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("payout_requests")
      .update({
        status: data.status,
        admin_note: data.adminNote ?? null,
        processed_at: new Date().toISOString(),
        processed_by: context.userId,
      })
      .eq("id", data.id);
    if (error) return { ok: false as const, message: "Mise à jour impossible." };
    return { ok: true as const, message: "Demande mise à jour." };
  });

/** Administration : total des commissions versées aux développeurs. */
export const getCommissionSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context))) throw new Error("Accès refusé");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("developer_earnings").select("amount_eur");
    const total = (data ?? []).reduce((s, e) => s + Number(e.amount_eur ?? 0), 0);
    return { total: Math.round(total * 100) / 100, count: (data ?? []).length };
  });
