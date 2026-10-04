import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type AdminStats = {
  users: number;
  generations: number;
  generationsToday: number;
  errors: number;
  pendingModeration: number;
  activeSubscriptions: number;
  secondsToday: number;
};

export type AdminGeneration = {
  id: string;
  prompt: string;
  media_type: string;
  status: string;
  media_url: string | null;
  error_message: string | null;
  duration_seconds: number;
  created_at: string;
};

/** Vérifie le rôle admin via le client authentifié (RLS), jamais via le service role. */
async function assertAdmin(context: {
  supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: boolean | null; error: unknown }> };
  userId: string;
  claims?: unknown;
}) {
  const claims = context.claims as { email?: unknown } | null;
  const email = typeof claims?.email === "string" ? claims.email.toLowerCase().trim() : "";
  if (email && OWNER_EMAILS.includes(email)) return;
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || data !== true) throw new Error("Accès refusé");
}


export type StaffRole = "admin" | "moderator" | "support" | "finance" | "user";

/** Adresses toujours administratrices, quel que soit le domaine utilisé. */
import { OWNER_EMAILS } from "@/lib/owners";

/** Rôles de l'utilisateur connecté (utilisé pour afficher le bureau d'administration). */
export const getAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = new Set((data ?? []).map((r) => r.role as StaffRole));

    // L'e-mail vient des claims du jeton : disponible sur tous les domaines.
    const claims = context.claims as { email?: unknown } | null;
    const email = typeof claims?.email === "string" ? claims.email.toLowerCase().trim() : "";

    if (email && OWNER_EMAILS.includes(email)) {
      roles.add("admin");
      // Auto-réparation : garantit le rôle en base pour les propriétaires.
      if (!(data ?? []).some((r) => r.role === "admin")) {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin
            .from("user_roles")
            .upsert({ user_id: context.userId, role: "admin" }, { onConflict: "user_id,role" });
        } catch {
          // Sans clé serveur, l'accès reste accordé pour cette session.
        }
      }
    }

    const list = [...roles];
    return {
      isAdmin: roles.has("admin"),
      roles: list,
      isStaff: list.some((r) => r !== "user"),
    };
  });

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date().toISOString().slice(0, 10);

    const [profiles, generations, todayGen, errors, pending, subs, usage] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("generations").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("generations")
        .select("id", { count: "exact", head: true })
        .gte("created_at", `${today}T00:00:00Z`),
      supabaseAdmin
        .from("generations")
        .select("id", { count: "exact", head: true })
        .eq("status", "error"),
      supabaseAdmin
        .from("community_gallery")
        .select("id", { count: "exact", head: true })
        .eq("status", "en_attente"),
      supabaseAdmin
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      supabaseAdmin.from("daily_usage").select("seconds_used").eq("usage_date", today),
    ]);

    const stats: AdminStats = {
      users: profiles.count ?? 0,
      generations: generations.count ?? 0,
      generationsToday: todayGen.count ?? 0,
      errors: errors.count ?? 0,
      pendingModeration: pending.count ?? 0,
      activeSubscriptions: subs.count ?? 0,
      secondsToday: (usage.data ?? []).reduce((sum, r) => sum + (r.seconds_used ?? 0), 0),
    };
    return stats;
  });

export const listRecentGenerations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("generations")
      .select(
        "id, prompt, media_type, status, media_url, error_message, duration_seconds, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(40);
    return (data ?? []) as AdminGeneration[];
  });


/** Générations en échec (OpenRouter / Grok Imagine), pour re-traitement. */
export const listFailedGenerations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("generations")
      .select(
        "id, user_id, prompt, media_type, resolution, duration, aspect_ratio, status, media_url, error_message, duration_seconds, created_at",
      )
      .eq("status", "error")
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });


/** Relance une génération en échec pour le compte de son propriétaire. */
export const retryGenerationAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Identifiant manquant");
    return { id: String(input.id) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("generations")
      .select("user_id, prompt, media_type, resolution, duration, aspect_ratio")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Génération introuvable");

    const { runGeneration } = await import("@/lib/services/generation.server");
    return await runGeneration(row.user_id, {
      prompt: row.prompt,
      mediaType: row.media_type === "image" ? "image" : "video",
      resolution: row.resolution ?? "720p",
      duration: row.duration ?? "6s",
      aspectRatio: row.aspect_ratio ?? "2:3",
    });
  });

export type AdminPrice = {
  id: string;
  label: string;
  tier: string;
  amount_eur: number;
  amount_eur_yearly: number | null;
  active: boolean;
  sort_order: number;
};

/** Liste des offres et de leur prix EUR (admin ou finance). */
export const listAdminPrices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminPrice[]> => {
    const { data } = await context.supabase
      .from("product_prices")
      .select("id, label, tier, amount_eur, amount_eur_yearly, active, sort_order")
      .order("sort_order", { ascending: true });
    return (data ?? []).map((row) => ({
      ...row,
      amount_eur: Number(row.amount_eur),
      amount_eur_yearly: row.amount_eur_yearly === null ? null : Number(row.amount_eur_yearly),
    }));
  });

/** Met à jour les prix EUR et l'état d'une offre (admin ou finance via RLS). */
export const updateAdminPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id: string;
    amountEur: number;
    amountEurYearly: number | null;
    active: boolean;
  }) => {
    if (typeof input?.id !== "string" || input.id.length === 0) throw new Error("Offre invalide");
    const amount = Number(input.amountEur);
    if (!Number.isFinite(amount) || amount < 0 || amount > 100000) throw new Error("Montant invalide");
    let yearly: number | null = null;
    if (input.amountEurYearly !== null && input.amountEurYearly !== undefined) {
      const y = Number(input.amountEurYearly);
      if (!Number.isFinite(y) || y < 0 || y > 1000000) throw new Error("Montant annuel invalide");
      yearly = Math.round(y * 100) / 100;
    }
    return {
      id: input.id,
      amountEur: Math.round(amount * 100) / 100,
      amountEurYearly: yearly,
      active: Boolean(input.active),
    };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("product_prices")
      .update({
        amount_eur: data.amountEur,
        amount_eur_yearly: data.amountEurYearly,
        active: data.active,
      })
      .eq("id", data.id);
    if (error) return { ok: false as const, message: "Mise à jour impossible." };
    return { ok: true as const };
  });

export type AdminOrder = {
  transaction_id: string;
  status: string;
  amount_eur: number;
  amount_local: number;
  currency: string;
  country_code: string;
  payment_method: string;
  customer_email: string;
  created_at: string;
};

/** Dernières commandes de paiement (admin). */
export const listAdminOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOrder[]> => {
    await assertAdmin(context);
    const { data } = await context.supabase
      .from("orders")
      .select(
        "transaction_id, status, amount_eur, amount_local, currency, country_code, payment_method, customer_email, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(25);
    return (data ?? []).map((row) => ({
      ...row,
      amount_eur: Number(row.amount_eur),
      amount_local: Number(row.amount_local),
    }));
  });

export type AdminSubscription = {
  id: string;
  user_id: string;
  tier: string;
  status: string;
  ends_at: string | null;
  created_at: string;
  email: string | null;
};

export const listAdminSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminSubscription[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("id, user_id, tier, status, ends_at, created_at")
      .order("ends_at", { ascending: true })
      .limit(100);

    const subscriptions = subs ?? [];
    
    // Récupération des e-mails en mémoire
    const userIds = [...new Set(subscriptions.map(s => s.user_id))];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .in("id", userIds);
      
    const emailMap = new Map(profiles?.map(p => [p.id, p.email]));

    return subscriptions.map(sub => ({
      id: sub.id,
      user_id: sub.user_id,
      tier: sub.tier,
      status: sub.status,
      ends_at: sub.ends_at,
      created_at: sub.created_at,
      email: emailMap.get(sub.user_id) ?? null,
    }));
  });

export type TimeSeriesData = {
  date: string;
  generations: number;
  images: number;
  videos: number;
  failed: number;
};

export const getAdminTimeSeries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TimeSeriesData[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Calcul pour les 14 derniers jours
    const now = new Date();
    const past = new Date(now.getTime() - 14 * 24 * 3600 * 1000);
    const startDateStr = past.toISOString().slice(0, 10) + "T00:00:00Z";

    const { data } = await supabaseAdmin
      .from("generations")
      .select("created_at, media_type, status")
      .gte("created_at", startDateStr);

    const map = new Map<string, TimeSeriesData>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
      const dStr = d.toISOString().slice(0, 10);
      map.set(dStr, { date: dStr, generations: 0, images: 0, videos: 0, failed: 0 });
    }

    if (data) {
      for (const row of data) {
        const dStr = row.created_at.slice(0, 10);
        const entry = map.get(dStr);
        if (entry) {
          entry.generations++;
          if (row.status === "error") {
            entry.failed++;
          } else {
            if (row.media_type === "image") entry.images++;
            else if (row.media_type === "video") entry.videos++;
          }
        }
      }
    }
    return Array.from(map.values());
  });

export type FinancialMetrics = {
  mrr: number;
  revenueThisMonth: number;
  totalRevenue: number;
  activeSubscribersByTier: Record<string, number>;
  churnRate: number;
  monthlyRevenueHistory: { month: string; revenue: number }[];
};

export const getFinancialDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FinancialMetrics> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch all successful orders
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("amount_eur, period, created_at, status")
      .eq("status", "payee");

    // Fetch all subscriptions
    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("tier, status, created_at, is_active");

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let mrr = 0;
    let revenueThisMonth = 0;
    let totalRevenue = 0;
    const monthlyRevenueMap = new Map<string, number>();

    // Initialiser les 6 derniers mois pour le graphique
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = d.toISOString().slice(0, 7); // YYYY-MM
      monthlyRevenueMap.set(monthStr, 0);
    }

    if (orders) {
      for (const order of orders) {
        const amount = Number(order.amount_eur) || 0;
        const createdDate = new Date(order.created_at);
        const monthStr = order.created_at.slice(0, 7); // YYYY-MM

        // Total revenue
        totalRevenue += amount;

        // Revenue this month
        if (createdDate >= firstOfThisMonth) {
          revenueThisMonth += amount;
        }

        // MRR (orders in last 30 days)
        if (createdDate >= thirtyDaysAgo) {
          if (order.period === "yearly" || order.period === "annually") {
            mrr += amount / 12;
          } else {
            mrr += amount;
          }
        }

        // Monthly history
        if (monthlyRevenueMap.has(monthStr)) {
          monthlyRevenueMap.set(monthStr, monthlyRevenueMap.get(monthStr)! + amount);
        }
      }
    }

    const activeSubscribersByTier: Record<string, number> = {};
    let totalSubs = 0;
    let inactiveSubs = 0;

    if (subs) {
      for (const sub of subs) {
        totalSubs++;
        const isActive = sub.status === "active" || sub.is_active === true;
        
        if (isActive) {
          const tier = sub.tier || "unknown";
          activeSubscribersByTier[tier] = (activeSubscribersByTier[tier] || 0) + 1;
        } else {
          inactiveSubs++;
        }
      }
    }

    const churnRate = totalSubs > 0 ? (inactiveSubs / totalSubs) * 100 : 0;
    const monthlyRevenueHistory = Array.from(monthlyRevenueMap.entries()).map(([month, revenue]) => ({
      month,
      revenue: Math.round(revenue * 100) / 100,
    }));

    return {
      mrr: Math.round(mrr * 100) / 100,
      revenueThisMonth: Math.round(revenueThisMonth * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      activeSubscribersByTier,
      churnRate: Math.round(churnRate * 100) / 100,
      monthlyRevenueHistory,
    };
  });

export type AdminUserItem = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  tier: string;
  plan_label: string;
  subscription_status: string | null;
  ends_at: string | null;
};

export type ListAdminUsersResult = {
  users: AdminUserItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * Liste paginée des utilisateurs inscrits (50 par page), avec recherche par email.
 */
export const listAdminUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { page?: number; search?: string }) =>
    z
      .object({
        page: z.number().int().min(1).default(1),
        search: z.string().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<ListAdminUsersResult> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const page = data.page ?? 1;
    const pageSize = 50;
    const offset = (page - 1) * pageSize;
    const search = (data.search ?? "").trim().toLowerCase();

    let query = supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, created_at", { count: "exact" })
      .order("created_at", { ascending: false });

    if (search) {
      query = query.ilike("email", `%${search}%`);
    }

    const { data: profiles, count, error } = await query.range(offset, offset + pageSize - 1);
    if (error) {
      console.error("[ADMIN] Erreur lors de la récupération des utilisateurs:", error);
      return { users: [], total: 0, page, pageSize, totalPages: 1 };
    }

    const rows = profiles ?? [];
    const userIds = rows.map((p) => p.id);

    // Récupération des abonnements correspondants
    const { data: subs } =
      userIds.length > 0
        ? await supabaseAdmin
            .from("subscriptions")
            .select("user_id, tier, status, ends_at, is_active")
            .in("user_id", userIds)
        : { data: [] };

    const subsMap = new Map((subs ?? []).map((s) => [s.user_id, s]));

    // Récupération des données auth (dernière connexion)
    const authList = await Promise.all(
      userIds.map(async (id) => {
        try {
          const res = await supabaseAdmin.auth.admin.getUserById(id);
          return { id, lastSignIn: res.data?.user?.last_sign_in_at ?? null };
        } catch {
          return { id, lastSignIn: null };
        }
      }),
    );
    const authMap = new Map(authList.map((a) => [a.id, a.lastSignIn]));

    const users: AdminUserItem[] = rows.map((p) => {
      const sub = subsMap.get(p.id);
      const isSubActive =
        sub &&
        (sub.status === "active" || sub.is_active === true) &&
        (!sub.ends_at || new Date(sub.ends_at) > new Date());

      let planLabel = "Gratuit";
      if (isSubActive && sub?.tier) {
        if (sub.tier === "superhearly" || sub.tier === "superhearly_monthly") {
          planLabel = "Super Grok Heavy";
        } else if (sub.tier === "super_grok_plus") {
          planLabel = "Super Grok Plus";
        } else if (
          sub.tier === "super_grok" ||
          sub.tier === "super_grok_monthly" ||
          sub.tier === "super_grok_annuel"
        ) {
          planLabel = "Super Grok";
        } else {
          planLabel = sub.tier;
        }
      }

      return {
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        created_at: p.created_at,
        last_sign_in_at: authMap.get(p.id) ?? null,
        tier: sub?.tier ?? "free",
        plan_label: planLabel,
        subscription_status: sub?.status ?? null,
        ends_at: sub?.ends_at ?? null,
      };
    });

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      users,
      total,
      page,
      pageSize,
      totalPages,
    };
  });

export type AdminUserDetail = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  signup_method: string;
  tier: string;
  plan_label: string;
  subscription_status: string | null;
  subscription_ends_at: string | null;
  is_subscribed: boolean;
  remaining_seconds_today: number | null;
  limit_seconds_today: number | null;
  total_images: number;
  total_videos: number;
  total_generations: number;
  recent_orders: {
    transaction_id: string;
    amount_eur: number;
    currency: string;
    status: string;
    created_at: string;
    payment_method: string;
  }[];
  support_tickets_count: number;
};

/**
 * Fiche détaillée en lecture seule d'un utilisateur pour l'administration.
 */
export const getAdminUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<AdminUserDetail> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const userId = data.userId;
    const today = new Date().toISOString().slice(0, 10);

    // 1. Profil
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, created_at")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      throw new Error("Utilisateur introuvable");
    }

    // 2. Auth user (dernière connexion + méthode)
    let lastSignInAt: string | null = null;
    let signupMethod = "Email";
    try {
      const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);
      const authUser = authData?.user;
      lastSignInAt = authUser?.last_sign_in_at ?? null;
      const provider =
        authUser?.app_metadata?.["provider"] ||
        (authUser?.identities && authUser.identities[0]?.provider);
      if (provider === "google") {
        signupMethod = "Google";
      } else if (provider === "email") {
        signupMethod = "Email";
      } else if (provider) {
        signupMethod = String(provider);
      }
    } catch {
      // ignore
    }

    // 3. Abonnement, Quotas, Générations, Commandes et Support
    const [subRes, quotaRes, usageRes, imgRes, vidRes, ordersRes, supportRes] =
      await Promise.all([
        supabaseAdmin
          .from("subscriptions")
          .select("tier, status, ends_at, is_active")
          .eq("user_id", userId)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from("user_quotas")
          .select("daily_video_limit_seconds, daily_video_remaining_seconds, quota_period_end")
          .eq("user_id", userId)
          .maybeSingle(),
        supabaseAdmin
          .from("daily_usage")
          .select("seconds_used, tier")
          .eq("user_id", userId)
          .eq("usage_date", today)
          .maybeSingle(),
        supabaseAdmin
          .from("generations")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("media_type", "image"),
        supabaseAdmin
          .from("generations")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("media_type", "video"),
        supabaseAdmin
          .from("orders")
          .select("transaction_id, amount_eur, currency, status, created_at, payment_method")
          .or(`user_id.eq.${userId},customer_email.eq.${profile.email || "nomatch"}`)
          .order("created_at", { ascending: false })
          .limit(10),
        supabaseAdmin
          .from("support_messages")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
      ]);

    const sub = subRes.data;
    const isSubActive =
      sub &&
      (sub.status === "active" || sub.is_active === true) &&
      (!sub.ends_at || new Date(sub.ends_at) > new Date());

    let planLabel = "Gratuit";
    let defaultLimitSeconds = 30;
    if (isSubActive && sub?.tier) {
      if (sub.tier === "superhearly" || sub.tier === "superhearly_monthly") {
        planLabel = "Super Grok Heavy";
        defaultLimitSeconds = 1200;
      } else if (sub.tier === "super_grok_plus") {
        planLabel = "Super Grok Plus";
        defaultLimitSeconds = 400;
      } else if (
        sub.tier === "super_grok" ||
        sub.tier === "super_grok_monthly" ||
        sub.tier === "super_grok_annuel"
      ) {
        planLabel = "Super Grok";
        defaultLimitSeconds = 200;
      } else {
        planLabel = sub.tier;
      }
    }

    // Secondes restantes aujourd'hui si abonné
    let remainingSeconds: number | null = null;
    let quotaLimit: number | null = null;
    if (isSubActive) {
      const quota = quotaRes.data;
      const usage = usageRes.data;
      if (quota) {
        const periodOver = quota.quota_period_end
          ? new Date(quota.quota_period_end) < new Date()
          : true;
        quotaLimit = quota.daily_video_limit_seconds ?? defaultLimitSeconds;
        remainingSeconds = periodOver
          ? quotaLimit
          : (quota.daily_video_remaining_seconds ?? quotaLimit);
      } else if (usage) {
        quotaLimit = defaultLimitSeconds;
        remainingSeconds = Math.max(0, defaultLimitSeconds - (usage.seconds_used ?? 0));
      } else {
        quotaLimit = defaultLimitSeconds;
        remainingSeconds = defaultLimitSeconds;
      }
    }

    const totalImages = imgRes.count ?? 0;
    const totalVideos = vidRes.count ?? 0;

    return {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      created_at: profile.created_at,
      last_sign_in_at: lastSignInAt,
      signup_method: signupMethod,
      tier: sub?.tier ?? "free",
      plan_label: planLabel,
      subscription_status: sub?.status ?? null,
      subscription_ends_at: sub?.ends_at ?? null,
      is_subscribed: !!isSubActive,
      remaining_seconds_today: remainingSeconds,
      limit_seconds_today: quotaLimit,
      total_images: totalImages,
      total_videos: totalVideos,
      total_generations: totalImages + totalVideos,
      recent_orders: (ordersRes.data ?? []).map((o) => ({
        transaction_id: o.transaction_id,
        amount_eur: Number(o.amount_eur),
        currency: o.currency,
        status: o.status,
        created_at: o.created_at,
        payment_method: o.payment_method,
      })),
      support_tickets_count: supportRes.count ?? 0,
    };
  });
