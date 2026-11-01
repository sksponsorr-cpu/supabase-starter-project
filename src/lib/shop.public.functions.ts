import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Boutique publique : lecture seule, accessible à tous (sans connexion). */
export const getPublicShop = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: shop } = await supabaseAdmin
      .from("shops")
      .select("name, description, phone, address, logo_url")
      .eq("user_id", data.id)
      .maybeSingle();
    if (!shop) return null;
    const { data: products } = await supabaseAdmin
      .from("shop_products")
      .select("id, name, price, description, category, image_url")
      .eq("user_id", data.id)
      .order("created_at", { ascending: false });
    return {
      name: shop.name as string,
      description: (shop.description as string) ?? "",
      phone: (shop.phone as string) ?? "",
      address: (shop.address as string) ?? "",
      logoUrl: (shop.logo_url as string | null) ?? null,
      products: (products ?? []).map((p) => ({
        id: p.id as string,
        name: p.name as string,
        price: (p.price as string) ?? "",
        description: (p.description as string) ?? "",
        category: (p.category as string) ?? "",
        imageUrl: (p.image_url as string | null) ?? null,
      })),
    };
  });
