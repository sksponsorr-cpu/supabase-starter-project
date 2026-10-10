import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAILS } from "@/lib/owners";

export type PromoCodeRow = {
  code: string;
  discount_eur: number;
  starts_at: string;
  ends_at: string;
  max_uses: number | null;
  used_count: number;
  active: boolean;
};

/** Vérifie que l'utilisateur est administrateur (ou propriétaire). */
async function assertAdmin(context: { claims: unknown; supabase: { rpc: (f: string, a: object) => Promise<{ data: unknown }> }; userId: string }) {
  const claims = context.claims as { email?: unknown } | null;
  const email = typeof claims?.email === "string" ? claims.email.toLowerCase().trim() : "";
  if (email && OWNER_EMAILS.includes(email)) return;
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (data !== true) throw new Error("Accès refusé");
}

export const listPromoCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PromoCodeRow[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("promo_codes")
      .select("code, discount_eur, starts_at, ends_at, max_uses, used_count, active")
      .order("created_at", { ascending: false });
    return (data ?? []).map((r) => ({
      ...r,
      discount_eur: Number(r.discount_eur),
    })) as PromoCodeRow[];
  });

export const savePromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/, "Lettres, chiffres, - et _ uniquement"),
        discountEur: z.number().positive().max(100000),
        startsAt: z.string().min(1),
        endsAt: z.string().min(1),
        maxUses: z.number().int().positive().nullable(),
        active: z.boolean(),
        isNew: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const start = new Date(data.startsAt);
    const end = new Date(data.endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { ok: false as const, message: "Dates invalides." };
    }
    if (end <= start) return { ok: false as const, message: "La date de fin doit être après le début." };

    const code = data.code.toUpperCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      code,
      discount_eur: Math.round(data.discountEur * 100) / 100,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      max_uses: data.maxUses,
      active: data.active,
    };

    if (data.isNew) {
      const { error } = await supabaseAdmin.from("promo_codes").insert(row);
      if (error) {
        return {
          ok: false as const,
          message: error.code === "23505" ? "Ce code existe déjà." : "Création impossible.",
        };
      }
    } else {
      const { error } = await supabaseAdmin.from("promo_codes").update(row).eq("code", code);
      if (error) return { ok: false as const, message: "Mise à jour impossible." };
    }
    return { ok: true as const };
  });

export const togglePromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().min(1).max(30), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("promo_codes")
      .update({ active: data.active })
      .eq("code", data.code.toUpperCase());
    if (error) return { ok: false as const, message: "Mise à jour impossible." };
    return { ok: true as const };
  });
