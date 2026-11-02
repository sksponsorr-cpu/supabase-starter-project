import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Commandes : création par le client (public), suivi et statut par le vendeur (connecté). */

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
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: product } = await supabaseAdmin
      .from("shop_products")
      .select("name, price")
      .eq("id", data.productId)
      .eq("user_id", data.shopUserId)
      .maybeSingle();
    if (!product) return { ok: false as const, id: null, message: "Article introuvable." };
    const { data: row, error } = await supabaseAdmin
      .from("shop_orders")
      .insert({
        user_id: data.shopUserId,
        product_id: data.productId,
        product_name: product.name as string,
        unit_price: (product.price as string) ?? "",
        quantity: data.quantity,
        customer_name: data.name,
        customer_phone: data.phone,
        customer_address: data.address,
      })
      .select("id")
      .single();
    if (error || !row) return { ok: false as const, id: null, message: "La commande n'a pas pu être enregistrée." };
    return { ok: true as const, id: row.id as string, message: null };
  });

export const listShopOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("shop_orders")
      .select("id, product_name, unit_price, quantity, customer_name, customer_phone, customer_address, status, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const setOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["nouvelle", "confirmée", "en livraison", "livrée", "annulée"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("shop_orders")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: !error };
  });
