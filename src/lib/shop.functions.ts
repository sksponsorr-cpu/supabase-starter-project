import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Boutique et produits du vendeur. Chaque action filtre sur l'utilisateur connecté (context.userId).
 * Les images doivent venir de notre stockage (presignAiUpload) : aucune URL externe n'est acceptée.
 */

const imageUrl = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .refine((u) => {
    if (!u) return true;
    const base = (process.env.CLOUDFLARE_R2_PUBLIC_URL ?? "").trim().replace(/\/+$/, "");
    return base !== "" && u.startsWith(`${base}/`);
  }, "Image non reconnue : importe-la depuis ton téléphone ou ton ordinateur.");

const shopInput = z.object({
  name: z.string().trim().min(2, "Donne le nom de ta boutique.").max(120),
  description: z.string().trim().max(800).default(""),
  phone: z.string().trim().max(40).default(""),
  address: z.string().trim().max(200).default(""),
  logoUrl: imageUrl,
});

const productInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Donne le nom du produit.").max(120),
  price: z.string().trim().max(60).default(""),
  description: z.string().trim().max(800).default(""),
  category: z.string().trim().max(80).default(""),
  imageUrl,
});

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

export const getShopOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const d = await db();
    const [shopRes, prodRes] = await Promise.all([
      d.from("shops").select("*").eq("user_id", context.userId).maybeSingle(),
      d.from("shop_products").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }),
    ]);
    if (shopRes.error || prodRes.error) return { ok: false as const, message: "Impossible de charger ta boutique. Réessaie." };
    return { ok: true as const, shop: shopRes.data ?? null, products: prodRes.data ?? [] };
  });

export const saveShop = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => shopInput.parse(raw))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const d = await db();
    const { data: row, error } = await d
      .from("shops")
      .upsert(
        {
          user_id: context.userId,
          name: data.name,
          description: data.description,
          phone: data.phone,
          address: data.address,
          logo_url: data.logoUrl ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single();
    if (error) return { ok: false as const, message: "La boutique n'a pas pu être enregistrée. Réessaie." };
    return { ok: true as const, shop: row };
  });

export const saveProduct = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => productInput.parse(raw))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const d = await db();
    const values = {
      name: data.name,
      price: data.price,
      description: data.description,
      category: data.category,
      image_url: data.imageUrl ?? null,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      // Mise à jour : la condition user_id empêche de modifier le produit d'un autre vendeur.
      const { data: row, error } = await d
        .from("shop_products")
        .update(values)
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .select("*")
        .maybeSingle();
      if (error || !row) return { ok: false as const, message: "Produit introuvable ou non modifiable." };
      return { ok: true as const, product: row };
    }
    const { data: row, error } = await d
      .from("shop_products")
      .insert({ ...values, user_id: context.userId })
      .select("*")
      .single();
    if (error) return { ok: false as const, message: "Le produit n'a pas pu être enregistré. Réessaie." };
    return { ok: true as const, product: row };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const d = await db();
    const { error } = await d.from("shop_products").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) return { ok: false as const, message: "Le produit n'a pas pu être supprimé." };
    return { ok: true as const };
  });
