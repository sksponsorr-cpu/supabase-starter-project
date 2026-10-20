import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { findCountry, formatLocalAmount } from "@/lib/payments/countries";
import { MIN_WITHDRAWAL_USD, EUR_PER_USD_APPROX } from "@/lib/partner-config";

type Db = any;

async function serviceDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function assertAdmin(context: {
  supabase: { rpc: (f: string, a: object) => Promise<{ data: unknown }> };
  userId: string;
}) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (data !== true) throw new Error("Accès refusé");
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function minimumEur(): number {
  return round2(MIN_WITHDRAWAL_USD * EUR_PER_USD_APPROX);
}

/** Minimum de retrait (5 $ ≈ en euros) converti dans la monnaie du pays du partenaire. */
async function minimumLocal(countryCode: string | null) {
  const country = countryCode ? findCountry(countryCode) : undefined;
  if (!country) return null;
  const { convertFromEur } = await import("@/lib/services/fx.server");
  const res = await convertFromEur(minimumEur(), country.currency, country.zeroDecimal);
  if (!res.ok) return null;
  return { amount: res.amount, currency: country.currency, zeroDecimal: country.zeroDecimal };
}

export type PartnerDashboard = {
  code: string;
  country: { code: string; name: string; currency: string } | null;
  signups: number;
  conversions: number;
  balance: { available: number; reserved: number; paid: number };
  minimumUsd: number;
  minimumEur: number;
  minimumLocal: { amount: number; currency: string; zeroDecimal: boolean } | null;
  sales: { id: string; date: string; orderAmount: number; commission: number; status: string }[];
  withdrawals: { id: string; date: string; amountEur: number; amountLocal: number; currency: string; status: string }[];
};

/** Tableau de bord du partenaire : évolution, solde séparé et retraits. */
export const getPartnerDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PartnerDashboard> => {
    const db = await serviceDb();
    const userId = context.userId;

    const { data: row } = await db
      .from("referral_codes")
      .select("code, country_code")
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) throw new Error("Code de parrainage introuvable.");

    const [{ count: signups }, { count: conversions }, { data: allComms }, { data: sales }, { data: wds }] =
      await Promise.all([
        db.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", userId),
        db
          .from("referrals")
          .select("id", { count: "exact", head: true })
          .eq("referrer_id", userId)
          .not("converted_at", "is", null),
        db.from("partner_commissions").select("status, commission_eur").eq("referrer_id", userId),
        db
          .from("partner_commissions")
          .select("id, order_amount_eur, commission_eur, status, created_at")
          .eq("referrer_id", userId)
          .order("created_at", { ascending: false })
          .limit(50),
        db
          .from("partner_withdrawals")
          .select("id, amount_eur, amount_local, currency, status, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

    const balance = { available: 0, reserved: 0, paid: 0 };
    for (const c of allComms ?? []) {
      const v = Number(c.commission_eur);
      if (c.status === "disponible") balance.available += v;
      else if (c.status === "reserve") balance.reserved += v;
      else if (c.status === "verse") balance.paid += v;
    }
    balance.available = round2(balance.available);
    balance.reserved = round2(balance.reserved);
    balance.paid = round2(balance.paid);

    const country = row.country_code ? findCountry(row.country_code) : undefined;

    return {
      code: row.code as string,
      country: country ? { code: country.code, name: country.name, currency: country.currency } : null,
      signups: signups ?? 0,
      conversions: conversions ?? 0,
      balance,
      minimumUsd: MIN_WITHDRAWAL_USD,
      minimumEur: minimumEur(),
      minimumLocal: await minimumLocal(row.country_code ?? null),
      sales: (sales ?? []).map((s: any) => ({
        id: s.id,
        date: s.created_at,
        orderAmount: Number(s.order_amount_eur),
        commission: Number(s.commission_eur),
        status: s.status,
      })),
      withdrawals: (wds ?? []).map((w: any) => ({
        id: w.id,
        date: w.created_at,
        amountEur: Number(w.amount_eur),
        amountLocal: Number(w.amount_local),
        currency: w.currency,
        status: w.status,
      })),
    };
  });

/** Pays de versement choisi par le partenaire (détermine la monnaie du retrait). */
export const setPartnerCountry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { countryCode: string }) =>
    z.object({ countryCode: z.string().length(2) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean; message?: string }> => {
    const country = findCountry(data.countryCode.toUpperCase());
    if (!country) return { ok: false, message: "Pays non pris en charge." };
    const db = await serviceDb();
    const { error } = await db
      .from("referral_codes")
      .update({ country_code: country.code })
      .eq("user_id", context.userId);
    return error ? { ok: false, message: "Enregistrement impossible." } : { ok: true };
  });

/** Demande de retrait du solde partenaire (commissions disponibles uniquement). */
export const requestPartnerWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { method: string; mobile: string }) =>
    z
      .object({
        method: z.string().trim().min(2).max(40),
        mobile: z.string().trim().min(6).max(20),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean; message: string }> => {
    const db = await serviceDb();
    const userId = context.userId;

    const { data: row } = await db.from("referral_codes").select("country_code").eq("user_id", userId).maybeSingle();
    const country = row?.country_code ? findCountry(row.country_code) : undefined;
    if (!country) return { ok: false, message: "Choisis d'abord ton pays de versement." };

    const { data: avail } = await db
      .from("partner_commissions")
      .select("id, commission_eur")
      .eq("referrer_id", userId)
      .eq("status", "disponible");
    const ids = (avail ?? []).map((c: any) => c.id as string);
    const total = round2((avail ?? []).reduce((s: number, c: any) => s + Number(c.commission_eur), 0));

    const min = minimumEur();
    if (total < min) {
      const local = await minimumLocal(country.code);
      const label = local ? formatLocalAmount(local.amount, local.currency) : `${MIN_WITHDRAWAL_USD} $`;
      return { ok: false, message: `Solde insuffisant. Minimum : ${label}.` };
    }

    const { convertFromEur } = await import("@/lib/services/fx.server");
    const conv = await convertFromEur(total, country.currency, country.zeroDecimal);
    if (!conv.ok) return { ok: false, message: "Taux de change indisponible, réessaie dans un instant." };

    const { data: w, error } = await db
      .from("partner_withdrawals")
      .insert({
        user_id: userId,
        amount_eur: total,
        country_code: country.code,
        currency: country.currency,
        amount_local: conv.amount,
        method: data.method,
        mobile: data.mobile,
        status: "en_attente",
      })
      .select("id")
      .single();
    if (error || !w) return { ok: false, message: "Demande impossible pour le moment." };

    await db
      .from("partner_commissions")
      .update({ status: "reserve", withdrawal_id: w.id })
      .in("id", ids)
      .eq("status", "disponible");

    return { ok: true, message: "Demande envoyée. Le versement suivra après vérification." };
  });

export type AdminPartnerOverview = {
  partners: {
    userId: string;
    code: string;
    countryCode: string | null;
    signups: number;
    conversions: number;
    available: number;
    paid: number;
  }[];
  pendingWithdrawals: {
    id: string;
    userId: string;
    code: string;
    amountEur: number;
    amountLocal: number;
    currency: string;
    method: string;
    mobile: string;
    date: string;
  }[];
};

/** Vue admin : évolution de chaque parrain et demandes de retrait à traiter. */
export const adminPartnerOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminPartnerOverview> => {
    await assertAdmin(context as any);
    const db = await serviceDb();

    const [{ data: codes }, { data: refs }, { data: comms }, { data: pending }] = await Promise.all([
      db.from("referral_codes").select("user_id, code, country_code").limit(500),
      db.from("referrals").select("referrer_id, converted_at").limit(5000),
      db.from("partner_commissions").select("referrer_id, commission_eur, status").limit(5000),
      db
        .from("partner_withdrawals")
        .select("id, user_id, amount_eur, amount_local, currency, method, mobile, created_at")
        .eq("status", "en_attente")
        .order("created_at", { ascending: true })
        .limit(100),
    ]);

    const codeByUser = new Map<string, { code: string; country_code: string | null }>();
    for (const c of codes ?? []) codeByUser.set(c.user_id, { code: c.code, country_code: c.country_code ?? null });

    const partners = [...codeByUser.entries()].map(([userId, info]) => {
      const mine = (refs ?? []).filter((r: any) => r.referrer_id === userId);
      const myComms = (comms ?? []).filter((c: any) => c.referrer_id === userId);
      const sum = (status: string) =>
        round2(myComms.filter((c: any) => c.status === status).reduce((s: number, c: any) => s + Number(c.commission_eur), 0));
      return {
        userId,
        code: info.code,
        countryCode: info.country_code,
        signups: mine.length,
        conversions: mine.filter((r: any) => r.converted_at).length,
        available: sum("disponible"),
        paid: sum("verse"),
      };
    });

    return {
      partners: partners.sort((a, b) => b.conversions - a.conversions),
      pendingWithdrawals: (pending ?? []).map((w: any) => ({
        id: w.id,
        userId: w.user_id,
        code: codeByUser.get(w.user_id)?.code ?? "—",
        amountEur: Number(w.amount_eur),
        amountLocal: Number(w.amount_local),
        currency: w.currency,
        method: w.method,
        mobile: w.mobile,
        date: w.created_at,
      })),
    };
  });

/** Admin : marque un retrait comme versé, ou le refuse (commissions remises disponibles). */
export const adminResolvePartnerWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; action: "verse" | "refuse" }) =>
    z.object({ id: z.string().uuid(), action: z.enum(["verse", "refuse"]) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    await assertAdmin(context as any);
    const db = await serviceDb();

    const { data: w } = await db.from("partner_withdrawals").select("status").eq("id", data.id).maybeSingle();
    if (!w || w.status !== "en_attente") return { ok: false };

    const now = new Date().toISOString();
    await db
      .from("partner_withdrawals")
      .update({ status: data.action === "verse" ? "verse" : "refuse", processed_at: now, processed_by: context.userId })
      .eq("id", data.id);

    if (data.action === "verse") {
      await db.from("partner_commissions").update({ status: "verse" }).eq("withdrawal_id", data.id);
    } else {
      await db.from("partner_commissions").update({ status: "disponible", withdrawal_id: null }).eq("withdrawal_id", data.id);
    }
    return { ok: true };
  });
