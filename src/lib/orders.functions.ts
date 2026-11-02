import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Commandes.
 * - Un client doit avoir un compte pour commander (il suit ensuite sa livraison).
 * - Le stock est vérifié et décrémenté dans la base, en une seule opération (fonction SQL).
 * - Chaque changement de statut est ajouté à l'historique de suivi.
 */

export const STATUSES = ["nouvelle", "confirmée", "en livraison", "livrée", "annulée"] as const;

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

function friendlyError(message: string): string {
  if (message.includes("stock_insuffisant")) return "Stock insuffisant pour cette quantité.";
  if (message.includes("article_introuvable")) return "Cet article n'est plus disponible.";
  if (message.includes("commande_introuvable")) return "Commande introuvable.";
  return "La commande n'a pas pu être enregistrée. Réessaie.";
}

export const createPublicOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        shopUserId: z.string().uuid(),
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(100),
        name: z.string().trim().min(2).max(120),
        phone: z.string().trim().min(6).max(30),
        address: z.string().trim().max(300),
        delivery: z.enum(["livraison", "retrait"]).default("livraison"),
      })
      .parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    if (data.delivery === "livraison" && data.address.length < 5) {
      return { ok: false as const, id: null, trackingCode: null, message: "Indique une adresse de livraison." };
    }
    const d = await db();
    const { data: row, error } = await d.rpc("place_shop_order", {
      p_shop_user: data.shopUserId,
      p_product: data.productId,
      p_quantity: data.quantity,
      p_customer: context.userId,
      p_name: data.name,
      p_phone: data.phone,
      p_address: data.delivery === "retrait" ? "Retrait en boutique" : data.address,
      p_delivery: data.delivery,
    });
    if (error || !row) {
      return { ok: false as const, id: null, trackingCode: null, message: friendlyError(error?.message ?? "") };
    }
    return { ok: true as const, id: row.id as string, trackingCode: row.tracking_code as string, message: null };
  });

/** Commandes reçues par le vendeur connecté. */
export const listShopOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const d = await db();
    const { data } = await d
      .from("shop_orders")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    return (data ?? []) as Record<string, unknown>[];
  });

/** Commandes passées par le client connecté (pour « Mes commandes »). */
export const listMyOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const d = await db();
    const { data } = await d
      .from("shop_orders")
      .select("*")
      .eq("customer_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []) as Record<string, unknown>[];
  });

/** Change le statut d'une commande et/ou ajoute une note de suivi (ex. « Livreur à 10 min »). */
export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(STATUSES),
        note: z.string().trim().max(300).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const d = await db();
    const { error } = await d.rpc("update_shop_order_status", {
      p_seller: context.userId,
      p_order: data.id,
      p_status: data.status,
      p_note: data.note,
    });
    if (error) return { ok: false as const, message: friendlyError(error.message ?? "") };
    return { ok: true as const, message: null };
  });

