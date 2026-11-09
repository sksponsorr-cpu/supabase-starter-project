import { creditCostFor } from "@/lib/credits";
import { getCreditConfig } from "@/lib/credits.server";
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
  | "insufficient_credits"
  | "queued";

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
/** Coût fixe pour les comptes gratuits : 10 crédits par vidéo, images gratuites. */
export const FREE_VIDEO_CREDITS = 10;
const FREE_USER_CONCURRENT = 2;
const FREE_GLOBAL_CONCURRENT = 3;
export function freeCreditCost(mediaType: "image" | "video"): number {
  return mediaType === "video" ? FREE_VIDEO_CREDITS : 0;
}

export async function checkGenerationAccess(
  userId: string,
  mediaType: "image" | "video",
  seconds = 0,
  opts?: { model?: string | null; resolution?: string; wallet?: string },
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
  // Durée par vidéo selon l'offre ET le modèle (table de lib/video-duration-limits.ts).
  const { clipCapFor } = await import("@/lib/video-duration-limits");
  const maxVideoSeconds = clipCapFor(
    planKey,
    (opts?.model ?? undefined) as import("@/lib/creator-models").ModelId | undefined,
  );

  if (!isSubscribed) {
    if (mediaType === "video") {
      if (seconds > 6) {
        return { ...base, allowed: false, code: "subscription_required", message: "Avec votre compte gratuit, les vidéos sont limitées à 6 secondes. Passez à une offre pour aller plus loin." };
      }
      const freeModels = ["veo-3-1", "grok-imagine"];
      if (opts?.model && !freeModels.includes(opts.model)) {
        return { ...base, allowed: false, code: "subscription_required", message: "Seedance est réservé aux abonnés. Avec votre compte gratuit, choisissez Veo 3.1 ou Grok Imagine." };
      }
    }
    // Crédits gratuits du jour : 10 crédits, renouvelés chaque jour.
    await supabaseAdmin.rpc("ensure_daily_free_credits", { p_user: userId, p_amount: 10 });
    const { isPricedModel, generationCreditsFor } = await import("@/lib/creator-pricing");
    const resolution = opts?.resolution === "1080p" || opts?.resolution === "480p" ? opts!.resolution : "720p";
    const cost = mediaType === "video" && opts?.model && isPricedModel(opts!.model)
      ? generationCreditsFor(opts!.model, resolution as never, 6)
      : freeCreditCost(mediaType);
    const { data: spendable } = await supabaseAdmin.rpc("spendable_credits", { p_user: userId });
    if (Number(spendable ?? 0) < cost) {
      return {
        ...base,
        allowed: false,
        code: "insufficient_credits",
        message: `Crédits gratuits insuffisants : ${cost} requis, ${Number(spendable ?? 0)} disponibles aujourd'hui. Vos crédits se renouvellent demain, ou passez à une offre.`,
      };
    }
    // File d'attente gratuite : 2 générations en cours par compte, 3 en même temps sur la plateforme.
    const since = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const { count: activeUser } = await supabaseAdmin
      .from("generations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "en_attente")
      .gte("created_at", since);
    if ((activeUser ?? 0) >= FREE_USER_CONCURRENT) {
      return {
        ...base,
        allowed: false,
        code: "subscription_required",
        message: "Vous avez déjà 2 générations en cours. Patientez, ou passez à une offre pour en lancer davantage.",
      };
    }
    const { count: activeAll } = await supabaseAdmin
      .from("generations")
      .select("id", { count: "exact", head: true })
      .eq("status", "en_attente")
      .gte("created_at", since);
    if ((activeAll ?? 0) >= FREE_GLOBAL_CONCURRENT) {
      const position = (activeAll ?? 0) - FREE_GLOBAL_CONCURRENT + 1;
      return {
        ...base,
        allowed: false,
        code: "queued",
        message: `File d'attente : position ${position}. Nouvelle tentative automatique dans quelques secondes.`,
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

  // Abonnés : contrôle du solde de crédits (même barème et même source que le débit réel)
  {
    const { isPricedModel, generationCreditsFor } = await import("@/lib/creator-pricing");
    const resolution = opts?.resolution === "1080p" || opts?.resolution === "480p" ? opts!.resolution : "720p";
    const config = await getCreditConfig();
    const cost =
      mediaType === "video" && opts?.model && isPricedModel(opts!.model)
        ? (generationCreditsFor(opts!.model, resolution as never, seconds) ?? creditCostFor(mediaType, seconds, resolution, config))
        : creditCostFor(mediaType, seconds, resolution, config);
    const { data: spendable } = await supabaseAdmin.rpc("spendable_credits", { p_user: userId });
    if (Number(spendable ?? 0) < cost) {
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
