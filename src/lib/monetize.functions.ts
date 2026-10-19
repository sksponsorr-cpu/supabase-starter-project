import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAILS } from "@/lib/owners";
import { toPlanType } from "@/lib/plans";

export type Tier = "essai" | "light" | "pro";

export type MonetizeSettings = {
  enabled: boolean;
  rpm_essai: number;
  rpm_light: number;
  rpm_pro: number;
  min_withdrawal_eur: number;
  min_views: number;
  hold_days: number;
  monthly_creator_cap_eur: number;
  monthly_budget_eur: number;
  eligible_countries: string[];
  withdrawal_methods: string;
  rules: string;
  mention_keywords: string;
};

export type CreatorVideo = {
  id: string;
  video_url: string;
  platform: string;
  published_at: string;
  claimed_views: number;
  source: "manual" | "tiktok";
  status: "pending" | "approved" | "rejected";
  verified_views: number | null;
  eligible_views: number | null;
  earned_eur: number;
  reject_reason: string | null;
  created_at: string;
};

export type CreatorWithdrawal = {
  id: string;
  amount_eur: number;
  method: string;
  status: "pending" | "paid" | "rejected";
  admin_note: string | null;
  created_at: string;
};

export type MonetizeOverview = {
  settings: MonetizeSettings;
  tier: Tier | null;
  country: string | null;
  adultConfirmed: boolean;
  countryEligible: boolean;
  balance: { total: number; available: number; pendingHold: number; withdrawn: number };
  videos: CreatorVideo[];
  withdrawals: CreatorWithdrawal[];
  tiktok: { configured: boolean; connected: boolean; displayName: string | null; lastSyncAt: string | null };
};

/* ------------------------------- Utilitaires ------------------------------ */

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

async function assertAdmin(context: {
  supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: boolean | null; error: unknown }> };
  userId: string;
  claims?: unknown;
}) {
  const claims = context.claims as { email?: unknown } | null;
  const email = typeof claims?.email === "string" ? claims.email.toLowerCase().trim() : "";
  if (email && OWNER_EMAILS.includes(email)) return;
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || data !== true) throw new Error("Accès refusé");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSettings(row: any): MonetizeSettings {
  return {
    enabled: row?.enabled !== false,
    rpm_essai: Number(row?.rpm_essai ?? 0.3),
    rpm_light: Number(row?.rpm_light ?? 0.5),
    rpm_pro: Number(row?.rpm_pro ?? 0.8),
    min_withdrawal_eur: Number(row?.min_withdrawal_eur ?? 25),
    min_views: Number(row?.min_views ?? 2500),
    hold_days: Number(row?.hold_days ?? 30),
    monthly_creator_cap_eur: Number(row?.monthly_creator_cap_eur ?? 50),
    monthly_budget_eur: Number(row?.monthly_budget_eur ?? 100),
    eligible_countries: Array.isArray(row?.eligible_countries) ? row.eligible_countries : [],
    withdrawal_methods: String(row?.withdrawal_methods ?? "Mobile Money"),
    rules: String(row?.rules ?? ""),
    mention_keywords: String(row?.mention_keywords ?? "samflash, sam flash, sam-flash"),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadSettings(db: any): Promise<MonetizeSettings> {
  const { data } = await db.from("monetize_settings").select("*").eq("id", "global").maybeSingle();
  return toSettings(data);
}

function rpmFor(s: MonetizeSettings, tier: Tier): number {
  return tier === "pro" ? s.rpm_pro : tier === "light" ? s.rpm_light : s.rpm_essai;
}

/** Offre active de l'utilisateur ramenée à Essai / Light / Pro (null = pas d'abonnement actif). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tierOf(db: any, userId: string): Promise<Tier | null> {
  const { data } = await db
    .from("subscriptions")
    .select("tier, plan_type, status, is_active, ends_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const active =
    !!data && data.status === "active" && data.is_active !== false && (!data.ends_at || new Date(data.ends_at) > new Date());
  if (!active) return null;
  const raw = String(data.plan_type ?? data.tier ?? "").toLowerCase();
  const plan = toPlanType(raw);
  if (plan === "free") return /essai|trial/.test(raw) ? "essai" : null;
  if (plan === "sam_flash_pro" || plan === "sam_flash_pro_annuel" || plan === "sam_flash_start" || plan === "sam_flash_one" || plan === "super_grok_plus" || plan === "superhearly_monthly") return "pro";
  return "light";
}

const ALLOWED_HOSTS: Record<string, string> = {
  "tiktok.com": "TikTok",
  "youtube.com": "YouTube",
  "youtu.be": "YouTube",
  "instagram.com": "Instagram",
  "facebook.com": "Facebook",
  "fb.watch": "Facebook",
};

function platformFor(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^(www|m|vm|vt)\./, "");
    for (const [domain, name] of Object.entries(ALLOWED_HOSTS)) {
      if (host === domain || host.endsWith("." + domain)) return name;
    }
  } catch {
    /* lien invalide */
  }
  return null;
}

function monthStartIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function balanceOf(db: any, userId: string, s: MonetizeSettings) {
  const [{ data: ledger }, { data: wds }] = await Promise.all([
    db.from("creator_earnings").select("amount_eur, created_at").eq("user_id", userId),
    db.from("creator_withdrawals").select("amount_eur, status").eq("user_id", userId).neq("status", "rejected"),
  ]);
  const holdMs = s.hold_days * 86400000;
  let total = 0;
  let available = 0;
  for (const e of ledger ?? []) {
    const a = Number(e.amount_eur ?? 0);
    total += a;
    if (Date.now() - new Date(e.created_at).getTime() >= holdMs) available += a;
  }
  const withdrawn = (wds ?? []).reduce((sum: number, w: { amount_eur: number }) => sum + Number(w.amount_eur), 0);
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    total: r(total - withdrawn),
    available: r(Math.max(0, available - withdrawn)),
    pendingHold: r(Math.max(0, total - available)),
    withdrawn: r(withdrawn),
  };
}

/**
 * Crédite un gain au créateur en respectant ses deux protections :
 * le plafond mensuel par créateur et le budget mensuel global. Renvoie le montant réellement crédité.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function creditEarning(db: any, s: MonetizeSettings, userId: string, videoId: string, wanted: number): Promise<number> {
  if (wanted <= 0) return 0;
  const since = monthStartIso();
  const [{ data: mine }, { data: all }] = await Promise.all([
    db.from("creator_earnings").select("amount_eur").eq("user_id", userId).gte("created_at", since),
    db.from("creator_earnings").select("amount_eur").gte("created_at", since),
  ]);
  const sum = (rows: { amount_eur: number }[] | null) => (rows ?? []).reduce((a, r) => a + Number(r.amount_eur), 0);
  let granted = wanted;
  if (s.monthly_creator_cap_eur > 0) granted = Math.min(granted, s.monthly_creator_cap_eur - sum(mine));
  if (s.monthly_budget_eur > 0) granted = Math.min(granted, s.monthly_budget_eur - sum(all));
  granted = Math.floor(Math.max(0, granted) * 100) / 100;
  if (granted <= 0) return 0;
  const { error } = await db.from("creator_earnings").insert({ user_id: userId, video_id: videoId, amount_eur: granted });
  return error ? 0 : granted;
}

/* ------------------------------- Utilisateur ------------------------------ */

export const getMonetizeOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MonetizeOverview> => {
    const db = await adminDb();
    const settings = await loadSettings(db);
    const [tier, { data: prof }, { data: vids }, { data: wds }, { data: tt }] = await Promise.all([
      tierOf(db, context.userId),
      db.from("creator_profiles").select("country, adult_confirmed").eq("user_id", context.userId).maybeSingle(),
      db
        .from("creator_videos")
        .select("id, video_url, platform, published_at, claimed_views, source, status, verified_views, eligible_views, earned_eur, reject_reason, created_at, ai_views, ai_confidence, ai_note")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(30),
      db
        .from("creator_withdrawals")
        .select("id, amount_eur, method, status, admin_note, created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(20),
      db.from("creator_tiktok_accounts").select("display_name, last_sync_at").eq("user_id", context.userId).maybeSingle(),
    ]);
    const country = (prof?.country as string | undefined) ?? null;
    return {
      settings,
      tier,
      country,
      adultConfirmed: prof?.adult_confirmed === true,
      countryEligible: !!country && settings.eligible_countries.includes(country),
      balance: await balanceOf(db, context.userId, settings),
      videos: (vids ?? []).map((v: CreatorVideo) => ({ ...v, earned_eur: Number(v.earned_eur) })),
      withdrawals: (wds ?? []).map((w: CreatorWithdrawal) => ({ ...w, amount_eur: Number(w.amount_eur) })),
      tiktok: {
        configured: (await import("@/lib/tiktok.server")).tiktokConfigured(),
        connected: !!tt,
        displayName: (tt?.display_name as string | undefined) ?? null,
        lastSyncAt: (tt?.last_sync_at as string | undefined) ?? null,
      },
    };
  });

export const saveCreatorProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { country: string; adult: boolean }) =>
    z.object({ country: z.string().regex(/^[A-Z]{2}$/), adult: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean; message: string }> => {
    if (!data.adult) return { ok: false, message: "Vous devez avoir 18 ans ou plus pour participer." };
    const db = await adminDb();
    const settings = await loadSettings(db);
    if (!settings.eligible_countries.includes(data.country)) {
      return { ok: false, message: "Ce pays n'est pas encore éligible à la monétisation." };
    }
    const { error } = await db
      .from("creator_profiles")
      .upsert({ user_id: context.userId, country: data.country, adult_confirmed: true }, { onConflict: "user_id" });
    if (error) return { ok: false, message: "Enregistrement impossible, réessayez." };
    return { ok: true, message: "Profil créateur enregistré." };
  });

export const submitMonetizeVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { videoUrl: string; publishedAt: string; claimedViews: number; screenRecordUrl: string }) =>
    z
      .object({
        videoUrl: z.string().trim().url().max(500),
        publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        claimedViews: z.number().int().min(0).max(1_000_000_000),
        screenRecordUrl: z.string().trim().max(500),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean; message: string }> => {
    const db = await adminDb();
    const settings = await loadSettings(db);
    if (!settings.enabled) return { ok: false, message: "Le programme est momentanément fermé." };
    const tier = await tierOf(db, context.userId);
    if (!tier) return { ok: false, message: "Il faut un abonnement actif pour participer." };
    const { data: prof } = await db
      .from("creator_profiles")
      .select("country, adult_confirmed")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!prof?.adult_confirmed || !settings.eligible_countries.includes(prof.country)) {
      return { ok: false, message: "Complétez d'abord votre profil créateur (pays éligible et 18 ans)." };
    }
    const platform = platformFor(data.videoUrl);
    if (!data.videoUrl.startsWith("https://") || !platform) {
      return { ok: false, message: "Lien non reconnu. Utilisez un lien TikTok, YouTube, Instagram ou Facebook." };
    }
    if (data.claimedViews < settings.min_views) {
      return { ok: false, message: `Il faut au moins ${settings.min_views.toLocaleString("fr-FR")} vues pour participer.` };
    }
    const published = new Date(data.publishedAt + "T00:00:00Z");
    if (Number.isNaN(published.getTime()) || published > new Date()) {
      return { ok: false, message: "Date de publication invalide." };
    }
    if ((Date.now() - published.getTime()) / 86400000 > 60) {
      return { ok: false, message: "Cette vidéo est trop ancienne (60 jours maximum)." };
    }
    const { count } = await db
      .from("creator_videos")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("status", "pending");
    if ((count ?? 0) >= 5) return { ok: false, message: "Vous avez déjà 5 vidéos en attente de vérification." };

    // Lecture des vues sur la capture ou la vidéo d'écran (proposition, validée ensuite par l'administrateur).
    const { readViewsFromEvidence } = await import("@/lib/services/views-analysis.server");
    const reading = data.screenRecordUrl ? await readViewsFromEvidence(data.screenRecordUrl) : null;

    const { error } = await db.from("creator_videos").insert({
      user_id: context.userId,
      video_url: data.videoUrl,
      platform,
      published_at: data.publishedAt,
      claimed_views: data.claimedViews,
      screen_record_url: data.screenRecordUrl || null,
      tier,
      ai_views: reading?.views ?? null,
      ai_confidence: reading?.confidence ?? null,
      ai_note: reading?.note || null,
    });
    if (error) {
      if (String(error.code) === "23505") return { ok: false, message: "Cette vidéo a déjà été soumise." };
      return { ok: false, message: "Envoi impossible, réessayez." };
    }
    return { ok: true, message: "Vidéo envoyée. Nous vérifions les vues rapidement." };
  });

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { method: string; details: string }) =>
    z.object({ method: z.string().trim().min(2).max(60), details: z.string().trim().min(4).max(300) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean; message: string }> => {
    const db = await adminDb();
    const settings = await loadSettings(db);
    const { data: prof } = await db.from("creator_profiles").select("country").eq("user_id", context.userId).maybeSingle();
    if (!prof || !settings.eligible_countries.includes(prof.country)) {
      return { ok: false, message: "Votre pays n'est pas éligible aux retraits." };
    }
    const { count } = await db
      .from("creator_withdrawals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("status", "pending");
    if ((count ?? 0) > 0) return { ok: false, message: "Une demande de retrait est déjà en cours." };
    const bal = await balanceOf(db, context.userId, settings);
    if (bal.available < settings.min_withdrawal_eur) {
      return { ok: false, message: `Retrait minimum : ${settings.min_withdrawal_eur} €. Solde disponible : ${bal.available} €.` };
    }
    const { error } = await db.from("creator_withdrawals").insert({
      user_id: context.userId,
      amount_eur: bal.available,
      country: prof.country,
      method: data.method,
      account_details: data.details,
    });
    if (error) return { ok: false, message: "Demande impossible, réessayez." };
    return { ok: true, message: "Demande de retrait envoyée. Vous serez payé dans votre monnaie locale." };
  });

/* --------------------------------- Admin ---------------------------------- */

export type AdminMonetizeVideo = CreatorVideo & {
  user_id: string;
  user_email: string | null;
  country: string | null;
  tier: Tier;
  screen_record_url: string | null;
};
export type AdminMonetizeWithdrawal = CreatorWithdrawal & {
  user_id: string;
  user_email: string | null;
  country: string;
  account_details: string;
};
export type AdminMonetizeOverview = {
  settings: MonetizeSettings;
  monthSpent: number;
  pendingVideos: AdminMonetizeVideo[];
  pendingWithdrawals: AdminMonetizeWithdrawal[];
};

export const adminMonetizeOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminMonetizeOverview> => {
    await assertAdmin(context);
    const db = await adminDb();
    const settings = await loadSettings(db);
    const [{ data: vids }, { data: wds }, { data: spent }] = await Promise.all([
      db.from("creator_videos").select("*").eq("status", "pending").eq("source", "manual").order("created_at", { ascending: true }).limit(50),
      db.from("creator_withdrawals").select("*").eq("status", "pending").order("created_at", { ascending: true }).limit(50),
      db.from("creator_earnings").select("amount_eur").gte("created_at", monthStartIso()),
    ]);
    const ids = [...new Set([...(vids ?? []), ...(wds ?? [])].map((r: { user_id: string }) => r.user_id))];
    const [{ data: profiles }, { data: creators }] = ids.length
      ? await Promise.all([
          db.from("profiles").select("id, email").in("id", ids),
          db.from("creator_profiles").select("user_id, country").in("user_id", ids),
        ])
      : [{ data: [] }, { data: [] }];
    const email = Object.fromEntries((profiles ?? []).map((p: { id: string; email: string }) => [p.id, p.email]));
    const country = Object.fromEntries((creators ?? []).map((c: { user_id: string; country: string }) => [c.user_id, c.country]));
    return {
      settings,
      monthSpent: Math.round((spent ?? []).reduce((a: number, r: { amount_eur: number }) => a + Number(r.amount_eur), 0) * 100) / 100,
      pendingVideos: (vids ?? []).map((v: AdminMonetizeVideo) => ({
        ...v,
        earned_eur: Number(v.earned_eur),
        user_email: email[v.user_id] ?? null,
        country: country[v.user_id] ?? null,
      })),
      pendingWithdrawals: (wds ?? []).map((w: AdminMonetizeWithdrawal) => ({
        ...w,
        amount_eur: Number(w.amount_eur),
        user_email: email[w.user_id] ?? null,
      })),
    };
  });

const settingsSchema = z.object({
  enabled: z.boolean(),
  rpm_essai: z.number().min(0).max(1000),
  rpm_light: z.number().min(0).max(1000),
  rpm_pro: z.number().min(0).max(1000),
  min_withdrawal_eur: z.number().min(0).max(100000),
  min_views: z.number().int().min(0).max(1_000_000_000),
  hold_days: z.number().int().min(0).max(365),
  monthly_creator_cap_eur: z.number().min(0).max(100000),
  monthly_budget_eur: z.number().min(0).max(10_000_000),
  eligible_countries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(250),
  withdrawal_methods: z.string().trim().max(300),
  rules: z.string().trim().max(3000),
  mention_keywords: z.string().trim().max(300),
});

export const adminSaveMonetizeSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: MonetizeSettings) => settingsSchema.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: boolean; message: string }> => {
    await assertAdmin(context);
    const db = await adminDb();
    const { error } = await db
      .from("monetize_settings")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", "global");
    if (error) return { ok: false, message: "Enregistrement impossible." };
    return { ok: true, message: "Réglages enregistrés." };
  });

export const adminReviewMonetizeVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; decision: "approve" | "reject"; verifiedViews: number; eligibleViews: number; reason: string }) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approve", "reject"]),
        verifiedViews: z.number().int().min(0).max(1_000_000_000),
        eligibleViews: z.number().int().min(0).max(1_000_000_000),
        reason: z.string().trim().max(300),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean; message: string }> => {
    await assertAdmin(context);
    const db = await adminDb();
    const { data: vid } = await db.from("creator_videos").select("*").eq("id", data.id).maybeSingle();
    if (!vid || vid.status !== "pending") return { ok: false, message: "Cette vidéo n'est plus en attente." };

    if (data.decision === "reject") {
      await db
        .from("creator_videos")
        .update({ status: "rejected", reject_reason: data.reason || "Vidéo non conforme.", reviewed_at: new Date().toISOString() })
        .eq("id", data.id);
      return { ok: true, message: "Vidéo refusée." };
    }

    const settings = await loadSettings(db);
    if (data.verifiedViews < settings.min_views) {
      return { ok: false, message: `Moins de ${settings.min_views} vues vérifiées : refusez la vidéo.` };
    }
    // Règle de lancement : la première vidéo validée d'un créateur n'est pas monétisée.
    const { count: approvedBefore } = await db
      .from("creator_videos")
      .select("id", { count: "exact", head: true })
      .eq("user_id", vid.user_id)
      .eq("status", "approved");
    const firstVideo = (approvedBefore ?? 0) === 0;
    const eligible = firstVideo ? 0 : Math.min(data.eligibleViews, data.verifiedViews);
    const rpm = rpmFor(settings, vid.tier as Tier);
    const raw = Math.floor((eligible / 1000) * rpm * 100) / 100;
    const earned = await creditEarning(db, settings, vid.user_id, vid.id, raw);
    if (raw > 0 && earned <= 0) {
      return { ok: false, message: "Plafond du créateur ou budget mensuel atteint. Augmentez-le dans les réglages ou validez le mois prochain." };
    }

    const { error } = await db
      .from("creator_videos")
      .update({
        status: "approved",
        verified_views: data.verifiedViews,
        eligible_views: eligible,
        rpm_eur: rpm,
        earned_eur: earned,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) return { ok: false, message: "Validation impossible." };
    if (firstVideo) {
      return { ok: true, message: "Première vidéo validée : non monétisée (règle de lancement). Les vidéos suivantes le seront." };
    }
    return { ok: true, message: `Vidéo validée : ${earned} € crédités.` };
  });

export const adminResolveWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: "paid" | "rejected"; note: string }) =>
    z.object({ id: z.string().uuid(), status: z.enum(["paid", "rejected"]), note: z.string().trim().max(300) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean; message: string }> => {
    await assertAdmin(context);
    const db = await adminDb();
    const { error } = await db
      .from("creator_withdrawals")
      .update({ status: data.status, admin_note: data.note || null, paid_at: data.status === "paid" ? new Date().toISOString() : null })
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) return { ok: false, message: "Mise à jour impossible." };
    return { ok: true, message: data.status === "paid" ? "Retrait marqué payé." : "Retrait refusé, le solde est rendu." };
  });

/* --------------------------------- TikTok --------------------------------- */

export const startTiktokConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; message: string; url?: string }> => {
    const { tiktokConfigured, buildAuthorizeUrl } = await import("@/lib/tiktok.server");
    if (!tiktokConfigured()) return { ok: false, message: "La connexion TikTok n'est pas encore activée." };
    const db = await adminDb();
    const settings = await loadSettings(db);
    const { data: prof } = await db.from("creator_profiles").select("country, adult_confirmed").eq("user_id", context.userId).maybeSingle();
    if (!prof?.adult_confirmed || !settings.eligible_countries.includes(prof.country)) {
      return { ok: false, message: "Complétez d'abord votre profil créateur (pays éligible et 18 ans)." };
    }
    const state = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    await db.from("tiktok_oauth_states").delete().eq("user_id", context.userId);
    const { error } = await db.from("tiktok_oauth_states").insert({ state, user_id: context.userId });
    if (error) return { ok: false, message: "Connexion impossible, réessayez." };
    return { ok: true, message: "", url: await buildAuthorizeUrl(state) };
  });

export const disconnectTiktok = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; message: string }> => {
    const db = await adminDb();
    await db.from("creator_tiktok_accounts").delete().eq("user_id", context.userId);
    return { ok: true, message: "Compte TikTok déconnecté." };
  });

/**
 * Lit les vidéos TikTok du créateur, repère celles qui parlent de Sam Flash (publiées après la connexion)
 * et calcule les gains selon les vues. Appelée à l'ouverture de la page et par le bouton « Actualiser ».
 */
export const syncMyTiktok = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; message: string }> => {
    const db = await adminDb();
    const settings = await loadSettings(db);
    const { data: acc } = await db.from("creator_tiktok_accounts").select("*").eq("user_id", context.userId).maybeSingle();
    if (!acc) return { ok: false, message: "Aucun compte TikTok connecté." };
    if (acc.last_sync_at && Date.now() - new Date(acc.last_sync_at).getTime() < 2 * 60 * 1000) {
      return { ok: true, message: "Déjà à jour." };
    }
    const { data: prof } = await db.from("creator_profiles").select("country, adult_confirmed").eq("user_id", context.userId).maybeSingle();
    if (!settings.enabled || !prof?.adult_confirmed || !settings.eligible_countries.includes(prof.country)) {
      return { ok: false, message: "Votre profil n'est pas éligible pour le moment." };
    }
    const tier = await tierOf(db, context.userId);

    try {
      const tk = await import("@/lib/tiktok.server");
      let access = acc.access_token as string;
      if (new Date(acc.access_expires_at).getTime() < Date.now() + 60 * 1000) {
        if (new Date(acc.refresh_expires_at).getTime() < Date.now()) {
          await db.from("creator_tiktok_accounts").delete().eq("user_id", context.userId);
          return { ok: false, message: "La connexion TikTok a expiré. Reconnectez votre compte." };
        }
        const t = await tk.refreshTokens(acc.refresh_token);
        access = t.access_token;
        await db
          .from("creator_tiktok_accounts")
          .update({
            access_token: t.access_token,
            refresh_token: t.refresh_token,
            access_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
            refresh_expires_at: new Date(Date.now() + t.refresh_expires_in * 1000).toISOString(),
          })
          .eq("user_id", context.userId);
      }

      const videos = await tk.fetchVideos(access);
      const keywords = settings.mention_keywords.split(/[,\n]/).map((k) => k.trim().toLowerCase()).filter(Boolean);
      const connectedAt = new Date(acc.connected_at).getTime();
      let found = 0;

      for (const v of videos) {
        const created = (v.create_time ?? 0) * 1000;
        if (!v.id || !v.share_url || created < connectedAt) continue;
        const text = `${v.title ?? ""} ${v.video_description ?? ""}`.toLowerCase();
        if (!keywords.some((k) => text.includes(k))) continue;
        found++;

        const views = Math.max(0, Math.floor(v.view_count ?? 0));
        const { data: existing } = await db
          .from("creator_videos")
          .select("id, status, earned_eur, tier")
          .eq("user_id", context.userId)
          .eq("external_id", v.id)
          .maybeSingle();

        const reached = views >= settings.min_views && !!tier;
        const useTier: Tier = tier ?? ((existing?.tier as Tier | undefined) ?? "essai");
        const rpm = rpmFor(settings, useTier);
        const oldEarned = Number(existing?.earned_eur ?? 0);
        // Les vues viennent directement de TikTok : tout est éligible, le pays du créateur étant éligible.
        const wanted = reached ? Math.floor((views / 1000) * rpm * 100) / 100 : 0;

        let videoId = existing?.id as string | undefined;
        if (!existing) {
          const { data: ins } = await db
            .from("creator_videos")
            .insert({
              user_id: context.userId,
              video_url: v.share_url,
              platform: "TikTok",
              published_at: new Date(created).toISOString().slice(0, 10),
              claimed_views: views,
              tier: useTier,
              source: "tiktok",
              external_id: v.id,
              status: "pending",
            })
            .select("id")
            .maybeSingle();
          videoId = ins?.id;
        }
        if (!videoId) continue;

        let earned = oldEarned;
        if (reached && wanted > oldEarned) {
          earned = Math.round((oldEarned + (await creditEarning(db, settings, context.userId, videoId, wanted - oldEarned))) * 100) / 100;
        }
        await db
          .from("creator_videos")
          .update({
            claimed_views: views,
            verified_views: views,
            eligible_views: views,
            rpm_eur: rpm,
            earned_eur: earned,
            status: reached || existing?.status === "approved" ? "approved" : "pending",
            reviewed_at: reached ? new Date().toISOString() : null,
          })
          .eq("id", videoId);
      }

      await db.from("creator_tiktok_accounts").update({ last_sync_at: new Date().toISOString() }).eq("user_id", context.userId);
      return {
        ok: true,
        message: found > 0 ? `${found} vidéo${found > 1 ? "s" : ""} Sam Flash détectée${found > 1 ? "s" : ""}.` : "Aucune vidéo Sam Flash détectée pour l'instant.",
      };
    } catch {
      return { ok: false, message: "Synchronisation TikTok impossible pour le moment." };
    }
  });
