import { TEAM_GOAL, TEAM_WINDOW_DAYS } from "@/lib/referral.functions";

/**
 * Appelé quand un paiement est confirmé : si l'acheteur a été parrainé et que
 * c'est son premier achat, la conversion est enregistrée pour le parrain.
 * Si le parrain atteint l'objectif en 30 jours, il est marqué « éligible équipe ».
 */
export async function creditReferralConversion(orderId: string, buyerId: string | null) {
  if (!buyerId) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;

  const { data: referral } = await db
    .from("referrals")
    .select("id, referrer_id, converted_at")
    .eq("referred_id", buyerId)
    .maybeSingle();
  if (!referral || referral.converted_at) return;

  const { error } = await db
    .from("referrals")
    .update({ converted_at: new Date().toISOString(), order_id: orderId })
    .eq("id", referral.id)
    .is("converted_at", null);
  if (error) return;

  const since = new Date(Date.now() - TEAM_WINDOW_DAYS * 86400000).toISOString();
  const { count } = await db
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", referral.referrer_id)
    .gte("converted_at", since);

  if ((count ?? 0) >= TEAM_GOAL) {
    await db
      .from("referral_codes")
      .update({ team_eligible_at: new Date().toISOString() })
      .eq("user_id", referral.referrer_id)
      .is("team_eligible_at", null);
  }
}
