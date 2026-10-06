import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAILS } from "@/lib/owners";

export type AppReview = {
  user_id: string;
  email: string | null;
  stars: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export type ReviewPage = {
  total: number;
  average: number;
  distribution: Record<string, number>;
  items: AppReview[];
};

// Les tables récentes ne sont pas dans types.ts (généré) : d'où le cast.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (t: string) => any };

/** Enregistre (ou met à jour) l'avis de l'utilisateur : une note + un commentaire par compte. */
export const submitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { stars: number; comment?: string }) =>
    z
      .object({
        stars: z.number().int().min(1).max(5),
        comment: z.string().trim().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const email = typeof context.claims["email"] === "string" ? context.claims["email"] : null;
    const { error } = await (context.supabase as unknown as AnyClient).from("app_reviews").upsert(
      {
        user_id: context.userId,
        email,
        stars: data.stars,
        comment: data.comment ? data.comment : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) return { ok: false as const, message: "Envoi impossible pour le moment." };
    return { ok: true as const };
  });

/** Bureau d'administration : avis paginés + statistiques (note moyenne, répartition). */
export const listReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { offset?: number; limit?: number }) =>
    z
      .object({
        offset: z.number().int().min(0).max(100000).default(0),
        limit: z.number().int().min(1).max(50).default(10),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<ReviewPage> => {
    const claims = context.claims as { email?: unknown } | null;
    const email = typeof claims?.email === "string" ? claims.email.toLowerCase().trim() : "";
    if (!(email && OWNER_EMAILS.includes(email))) {
      const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (error || isAdmin !== true) throw new Error("Accès refusé");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as AnyClient;

    const { data: rows, count } = await db
      .from("app_reviews")
      .select("user_id, email, stars, comment, created_at, updated_at", { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);

    const { data: all } = await db.from("app_reviews").select("stars").limit(20000);
    const distribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    let sum = 0;
    const list = (all ?? []) as { stars: number }[];
    for (const r of list) {
      distribution[String(r.stars)] = (distribution[String(r.stars)] ?? 0) + 1;
      sum += r.stars;
    }
    return {
      total: count ?? list.length,
      average: list.length ? sum / list.length : 0,
      distribution,
      items: (rows ?? []) as AppReview[],
    };
  });
