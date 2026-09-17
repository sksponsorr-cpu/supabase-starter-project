/**
 * Contrôle d'accès à la génération : formule active, quota vidéo restant
 * et limitation de l'offre gratuite à un seul compte par appareil.
 */
import { toPlanType, type PlanType } from "@/lib/plans";

export type AccessCode =
  | "ok"
  | "device_free_used"
  | "subscription_required"
  | "video_seconds"
  | "subscription_expired";

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

  if (!isSubscribed && (await deviceFreeAlreadyUsed(userId))) {
    return { ...base, allowed: false, code: "device_free_used", message: DEVICE_MESSAGE };
  }

  // LIMITES À VIE POUR LES UTILISATEURS GRATUITS
  if (!isSubscribed) {
    const { count: imageCount } = await supabaseAdmin
      .from("generations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("media_type", "image")
      .neq("status", "error");

    const { count: videoCount } = await supabaseAdmin
      .from("generations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("media_type", "video")
      .neq("status", "error");

    if (mediaType === "image" && (imageCount ?? 0) >= 3) {
      return {
        ...base,
        allowed: false,
        code: "subscription_required",
        message: "Limite à vie de 3 images gratuites atteinte. Passez à une offre supérieure pour continuer.",
      };
    }

    if (mediaType === "video") {
      if ((videoCount ?? 0) >= 1) {
        return {
          ...base,
          allowed: false,
          code: "subscription_required",
          message: "Limite à vie d'une vidéo gratuite atteinte. Passez à une offre supérieure pour continuer.",
        };
      }
      if (seconds > 3) {
        return {
          ...base,
          allowed: false,
          code: "subscription_required",
          message: "Les vidéos gratuites sont limitées à 3 secondes maximum. Passez à une offre supérieure pour des vidéos plus longues.",
        };
      }
    }

    return { ...base, allowed: true, code: "ok", message: null };
  }

  // LOGIQUE POUR LES UTILISATEURS PAYANTS (Super Grok / Superhearly)
  if (mediaType === "video") {
    if (!isSubscribed && expired) {
      return {
        ...base,
        allowed: false,
        code: "subscription_expired",
        message:
          "Votre abonnement est arrivé à expiration. Réabonnez-vous pour continuer à générer des vidéos.",
      };
    }
    if (seconds > 0 && remainingSeconds < seconds) {
      return {
        ...base,
        allowed: false,
        code: isSubscribed ? "video_seconds" : "subscription_required",
        message: isSubscribed
          ? "Limite quotidienne atteinte : vos secondes vidéo sont épuisées pour cette période."
          : "Votre offre gratuite est épuisée. Abonnez-vous à Super Grok pour générer plus de vidéos.",
      };
    }
  }

  return { ...base, allowed: true, code: "ok", message: null };
}
