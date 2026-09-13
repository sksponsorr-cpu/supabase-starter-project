/**
 * Commissions développeurs : 20 % du montant de chaque paiement réussi sont
 * répartis à parts égales entre les développeurs actifs, puis ajoutés à leur solde.
 */
export const DEVELOPER_COMMISSION_RATE = 0.2;

export async function creditDeveloperCommissions(orderId: string, amountEur: number) {
  if (!Number.isFinite(amountEur) || amountEur <= 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: devs } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "developer");

  const ids = [...new Set((devs ?? []).map((d) => d.user_id))];
  if (ids.length === 0) return;

  const share = Math.round(((amountEur * DEVELOPER_COMMISSION_RATE) / ids.length) * 100) / 100;
  if (share <= 0) return;

  await supabaseAdmin.from("developer_earnings").upsert(
    ids.map((developer_id) => ({
      developer_id,
      order_id: orderId,
      amount_eur: share,
      rate: DEVELOPER_COMMISSION_RATE / ids.length,
    })),
    { onConflict: "developer_id,order_id" },
  );
}
