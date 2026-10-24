import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Taux : 3 crédits créateur = 1 crédit vendeur. */
export const CREATOR_PER_SELLER = 3;

export const getWallets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const { data: prof } = await db.from("profiles").select("credits_balance").eq("id", context.userId).maybeSingle();
    const { data: seller } = await db.from("seller_wallets").select("balance").eq("user_id", context.userId).maybeSingle();
    return {
      creator: Number(prof?.credits_balance ?? 0),
      seller: Number(seller?.balance ?? 0),
      rate: CREATOR_PER_SELLER,
    };
  });

/** Transfère des crédits créateur vers le solde vendeur. Sens unique, montant en crédits vendeur. */
export const transferToSeller = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ sellerAmount: z.number().int().min(1).max(100000) }).parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const cost = data.sellerAmount * CREATOR_PER_SELLER;
    const { data: prof } = await db.from("profiles").select("credits_balance").eq("id", context.userId).maybeSingle();
    const creator = Number(prof?.credits_balance ?? 0);
    if (creator < cost) return { ok: false, message: `Il faut ${cost} crédits créateur pour obtenir ${data.sellerAmount} crédit(s) vendeur. Tu en as ${creator}.` };

    const { error: debitErr } = await db.from("profiles").update({ credits_balance: creator - cost }).eq("id", context.userId);
    if (debitErr) return { ok: false, message: "Transfert impossible pour le moment." };

    const { data: sw } = await db.from("seller_wallets").select("balance").eq("user_id", context.userId).maybeSingle();
    const sellerNow = Number(sw?.balance ?? 0) + data.sellerAmount;
    const { error: upErr } = await db
      .from("seller_wallets")
      .upsert({ user_id: context.userId, balance: sellerNow, updated_at: new Date().toISOString() });
    if (upErr) {
      // Rembourse le créateur si le solde vendeur n'a pas pu être crédité.
      await db.from("profiles").update({ credits_balance: creator }).eq("id", context.userId);
      return { ok: false, message: "Transfert annulé : crédits non transférés." };
    }
    await db.from("credit_transfers").insert({ user_id: context.userId, creator_debited: cost, seller_credited: data.sellerAmount }).then(() => null, () => null);
    return { ok: true, message: `${data.sellerAmount} crédit(s) vendeur ajouté(s). Nouveau solde vendeur : ${sellerNow}.` };
  });
