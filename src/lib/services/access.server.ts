import { creditCostFor } from "@/lib/credits";
/**
 * Contrôle d'accès à la génération : formule active, quota vidéo restant
 * et limitation de l'offre gratuite à un seul compte par appareil.
 */
import { toPlanType, type PlanType } from "@/lib/plans";
import { getRequest } from "@tanstack/react-start/server";
import { createHash } from "node:crypto";

/** Adresse IP du client, hachée (lue côté serveur, non falsifiable depuis le navigateur). */
export function clientIpHash(): string | null {
  try {
    const raw = getRequest()?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (!raw) return null;
    return createHash("sha256").update(raw).digest("hex");
  } catch {
    return null;
  }
}

export type AccessCode =
  | "ok"
  | "device_free_used"
  | "subscription_required"
  | "video_seconds"
  | "subscription_expired"
  | "insufficient_credits";

export type AccessResult = {
  allowed: boolean;
  code: AccessCode;
  planType: PlanType;
  isSubscribed: boolean;
  remainingSeconds: number;
  limitSeconds: number;
  message: string | null;
};

const DEVICE_MESSAGE =
  "L'offre gratuite a déjà été utilisée sur cet appareil. Abonnez-vous à Super Grok pour continuer à générer des vidéos.";

/** L'appareil de cet utilisateur a-t-il déjà servi l'offre gratuite à un autre compte ? */
export async function deviceFreeAlreadyUsed(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: devices } = await supabaseAdmin
    .from("user_devices")
    .select("fingerprint")
    .eq("user_id", userId);

  const prints = (devices ?? []).map((d) => d.fingerprint);
  if (prints.length === 0) return false;

  const { data: owners } = await supabaseAdmin
    .from("device_fingerprints")
    .select("fingerprint, first_user_id")
    .in("fingerprint", prints);

  return (owners ?? []).some((o) => o.first_user_id !== userId);
}

/** Formule active de l'utilisateur (ou « free »). */
export async function activePlan(userId: string): Promise<{ plan: PlanType; expired: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("tier, plan_type, status, is_active, ends_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const active =
    !!data &&
    data.status === "active" &&
    data.is_active !== false &&
    (!data.ends_at || new Date(data.ends_at) > new Date());

  return {
    plan: active ? toPlanType(data?.plan_type ?? data?.tier) : "free",
    expired: !!data && !active,
  };
}

/**
 * Vérifie l'accès AVANT tout appel au moteur de génération,
 * afin de ne jamais consommer de crédit pour un utilisateur sans droit.
 */
export async function checkGenerationAccess(
  userId: string,
  mediaType: "image" | "video",
  seconds = 0,
): Promise<AccessResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: profile, error: profileError } = await supabaseAdmin.from("profiles").select("role").eq("id", userId).maybeSingle();
  console.log("[ADMIN-CHECK] verify profile:", { userId, role: profile?.role, error: profileError ? { message: profileError.message, code: profileError.code } : null });
  if (profile?.role === "admin") {
    return {
      allowed: true,
      code: "ok",
      planType: "super_grok",
      isSubscribed: true,
      remainingSeconds: 9999,
      limitSeconds: 9999,
      message: null,
    };
  }

  const { plan, expired } = await activePlan(userId);
  const isSubscribed = plan !== "free";

  const { data: quota } = await supabaseAdmin
    .from("user_quotas")
    .select("daily_video_limit_seconds, daily_video_remaining_seconds, quota_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  const limitSeconds = quota?.daily_video_limit_seconds ?? 30;
  const periodOver = quota?.quota_period_end ? new Date(quota.quota_period_end) < new Date() : true;
  const remainingSeconds = periodOver ? limitSeconds : (quota?.daily_video_remaining_seconds ?? limitSeconds);

  const base = { planType: plan, isSubscribed, remainingSeconds, limitSeconds };

  // Durée maximale d'une vidéo selon l'offre (secondes)
  const planKey = plan as string;
  const maxVideoSeconds =
    planKey === "superhearly" || planKey === "superhearly_monthly" ? 15
    : planKey === "super_grok_plus" ? 10
    : 8;

  if (!isSubscribed) {
    if (mediaType === "video") {
      // Vidéo réservée à ceux qui ont déjà acheté quelque chose (recharge ou abonnement)
      const { data: bought } = await supabaseAdmin
        .from("credit_ledger")
        .select("id")
        .eq("user_id", userId)
        .in("kind", ["recharge", "pass", "abonnement", "annuel_mensuel"])
        .limit(1);
      if (!bought || bought.length === 0) {
        return {
          ...base,
          allowed: false,
          code: "subscription_required",
          message: "La génération vidéo est réservée aux abonnés. Rechargez votre compte ou abonnez-vous pour continuer.",
        };
      }
      if (seconds > 8) {
        return {
          ...base,
          allowed: false,
          code: "subscription_required",
          message: "Avec une recharge, les vidéos sont limitées à 8 secondes. Passez à un abonnement supérieur pour des vidéos plus longues.",
        };
      }
    }
    await supabaseAdmin.rpc("claim_free_credits", { p_user: userId, p_ip_hash: clientIpHash() });
    const { data: wallet } = await supabaseAdmin
      .from("profiles")
      .select("credits_balance")
      .eq("id", userId)
      .maybeSingle();
    if ((wallet?.credits_balance ?? 0) < creditCostFor(mediaType, seconds, "480p")) {
      return {
        ...base,
        allowed: false,
        code: "insufficient_credits",
        message: "L'offre gratuite est terminée pour l'instant. Réessayez plus tard ou passez à un forfait supérieur.",
      };
    }
    return { ...base, allowed: true, code: "ok", message: null };
  }

  // Abonnés : durée vidéo selon l'offre
  if (mediaType === "video" && seconds > maxVideoSeconds) {
    return {
      ...base,
      allowed: false,
      code: "subscription_required",
      message: `Votre offre permet des vidéos jusqu'à ${maxVideoSeconds} secondes. Passez à un abonnement supérieur pour aller plus loin.`,
    };
  }

  // Abonnés : contrôle du solde de crédits
  {
    const cost = creditCostFor(mediaType, seconds, "480p");
    const { data: wallet } = await supabaseAdmin
      .from("profiles")
      .select("credits_balance")
      .eq("id", userId)
      .maybeSingle();
    if ((wallet?.credits_balance ?? 0) < cost) {
      return {
        ...base,
        allowed: false,
        code: "insufficient_credits",
        message: "Crédits insuffisants. Rechargez votre compte pour continuer.",
      };
    }
  }

  // LOGIQUE POUR LES UTILISATEURS PAYANTS (Super Grok / Superhearly)
  if (mediaType === "video") {
    if (!isSubscribed && expired) {
      console.log("[ADMIN-CHECK] refus: abonnement expire");
      return {
        ...base,
        allowed: false,
        code: "subscription_expired",
        message:
          "Votre abonnement est arrivé à expiration. Réabonnez-vous pour continuer à générer des vidéos.",
      };
    }
  }

  return { ...base, allowed: true, code: "ok", message: null };
}
