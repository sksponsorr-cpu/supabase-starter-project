import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Clés des cartes de l'espace vendeur (une image par carte). */
export const SELLER_CARD_KEYS = [
  "histoire-racontee", "ugc", "pub-animee", "professionnel",
  "avant-apres", "temoignage", "publicite-produit", "promotion",
] as const;

async function assertAdmin(context: { userId: string; claims?: unknown; supabase: unknown }) {
  const { isOwnerEmail } = await import("@/lib/owners");
  const claims = context.claims as { email?: unknown } | null;
  const email = typeof claims?.email === "string" ? claims.email : null;
  if (!isOwnerEmail(email)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data, error } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || data !== true) throw new Error("Accès refusé");
  }
}

/** Images actuelles des cartes (lecture publique). */
export const listSellerCardImages = createServerFn({ method: "GET" }).handler(async (): Promise<Record<string, string>> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const { data } = await db.from("seller_card_images").select("style_key, image_url");
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as { style_key: string; image_url: string }[]) out[r.style_key] = r.image_url;
  return out;
});

/** Téléverse l'image d'une carte (fichier envoyé en base64, 3 Mo maximum) et la rattache à la carte. */
export const adminSetSellerCardImage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        styleKey: z.enum(SELLER_CARD_KEYS),
        dataUrl: z.string().startsWith("data:image/").max(4_000_000),
      })
      .parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const m = /^data:(image\/(png|jpeg|webp));base64,(.+)$/.exec(data.dataUrl);
    if (!m) return { ok: false, message: "Format d'image non pris en charge (PNG, JPG ou WebP)." };
    const buffer = Buffer.from(m[3], "base64");
    if (buffer.length > 3 * 1024 * 1024) return { ok: false, message: "Image trop lourde (3 Mo maximum)." };
    const ext = m[2] === "jpeg" ? "jpg" : m[2];
    const path = `${data.styleKey}-${Date.now()}.${ext}`;
    const up = await db.storage.from("seller-cards").upload(path, buffer, { contentType: m[1], upsert: false });
    if (up.error) return { ok: false, message: "Envoi impossible pour le moment." };
    const url = db.storage.from("seller-cards").getPublicUrl(path).data.publicUrl as string;
    const { error } = await db
      .from("seller_card_images")
      .upsert({ style_key: data.styleKey, image_url: url, updated_at: new Date().toISOString() });
    if (error) return { ok: false, message: "Image envoyée mais non enregistrée." };
    return { ok: true, message: "Image enregistrée sur la carte.", url };
  });
