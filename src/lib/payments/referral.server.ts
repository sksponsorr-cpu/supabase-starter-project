import { PARTNER_COMMISSION_PERCENT } from "@/lib/partner-config";

/**
 * Appelé quand un paiement est confirmé : si l'acheteur a été parrainé et que
 * c'est son premier achat, la conversion est enregistrée pour le parrain.
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

  // Commission partenaire : pourcentage du montant payé, enregistrée une seule fois par commande.
  const { data: order } = await db.from("orders").select("amount_eur").eq("id", orderId).maybeSingle();
  const amount = Number(order?.amount_eur ?? 0);
  const { data: application } = await db
    .from("partner_applications")
    .select("status")
    .eq("user_id", referral.referrer_id)
    .maybeSingle();
  if (amount > 0 && application?.status === "approuve") {
    const commission = Math.round(amount * PARTNER_COMMISSION_PERCENT) / 100;
    await db.from("partner_commissions").upsert(
      {
        referrer_id: referral.referrer_id,
        referred_id: buyerId,
        order_id: orderId,
        order_amount_eur: amount,
        commission_eur: commission,
        status: "disponible",
      },
      { onConflict: "order_id", ignoreDuplicates: true },
    );
  }
}
