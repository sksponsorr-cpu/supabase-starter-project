import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Objectif du palier « Membre d'équipe » : 10 achats en 30 jours. */
export const TEAM_GOAL = 10;
export const TEAM_WINDOW_DAYS = 30;
/** Un compte ne peut être rattaché à un parrain que dans ses premiers jours. */
const CLAIM_MAX_ACCOUNT_AGE_DAYS = 3;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length = 8) {
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export type ReferralOverview = {
  code: string;
  signups: number;
  conversions: number;
  conversionsLast30Days: number;
  goal: number;
  teamEligibleAt: string | null;
};

/** Code de parrainage de l'utilisateur (créé à la demande) et ses statistiques. */
export const getMyReferral = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReferralOverview> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    let { data: row } = await db
      .from("referral_codes")
      .select("code, team_eligible_at")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!row) {
      for (let attempt = 0; attempt < 5 && !row; attempt++) {
        const { data: created } = await db
          .from("referral_codes")
          .insert({ user_id: context.userId, code: randomCode() })
          .select("code, team_eligible_at")
          .maybeSingle();
        if (created) row = created;
        else {
          const { data: again } = await db
            .from("referral_codes")
            .select("code, team_eligible_at")
            .eq("user_id", context.userId)
            .maybeSingle();
          if (again) row = again;
        }
      }
    }
    if (!row) throw new Error("Impossible de créer votre code de parrainage");

    const since = new Date(Date.now() - TEAM_WINDOW_DAYS * 86400000).toISOString();
    const [{ count: signups }, { count: conversions }, { count: recent }] = await Promise.all([
      db.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", context.userId),
      db
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referrer_id", context.userId)
        .not("converted_at", "is", null),
      db
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referrer_id", context.userId)
        .gte("converted_at", since),
    ]);

    return {
      code: row.code as string,
      signups: signups ?? 0,
      conversions: conversions ?? 0,
      conversionsLast30Days: recent ?? 0,
      goal: TEAM_GOAL,
      teamEligibleAt: (row.team_eligible_at as string | null) ?? null,
    };
  });

/** Rattache le compte connecté au parrain correspondant au code (une seule fois). */
export const claimReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) =>
    z.object({ code: z.string().trim().min(4).max(16) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const code = data.code.toUpperCase();

    const { data: owner } = await db
      .from("referral_codes")
      .select("user_id")
      .eq("code", code)
      .maybeSingle();
    if (!owner || owner.user_id === context.userId) return { ok: false };

    const { data: profile } = await db
      .from("profiles")
      .select("created_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile?.created_at) return { ok: false };
    const ageDays = (Date.now() - new Date(profile.created_at).getTime()) / 86400000;
    if (ageDays > CLAIM_MAX_ACCOUNT_AGE_DAYS) return { ok: false };

    const { error } = await db.from("referrals").insert({
      referrer_id: owner.user_id,
      referred_id: context.userId,
      code,
    });
    return { ok: !error };
  });
