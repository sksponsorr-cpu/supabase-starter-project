import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAILS } from "@/lib/owners";

export const ONBOARDING_SOURCES = ["youtube", "tiktok", "facebook", "google", "gemini", "other"] as const;
export type OnboardingSource = (typeof ONBOARDING_SOURCES)[number] | "ignore";

export type OnboardingResponse = {
  user_id: string;
  email: string | null;
  source: OnboardingSource;
  other_text: string | null;
  created_at: string;
};

export type OnboardingReport = {
  total: number;
  counts: Record<string, number>;
  items: OnboardingResponse[];
};

// La table est récente : elle n'est pas encore dans types.ts (généré), d'où le cast.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (t: string) => any };

/** L'utilisateur a-t-il déjà répondu (ou ignoré) l'enquête ? */
export const getMyOnboarding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as unknown as AnyClient)
      .from("onboarding_responses")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    // En cas d'erreur (table absente, réseau…) on ne dérange pas l'utilisateur.
    if (error) return { answered: true as const };
    return { answered: Boolean(data) };
  });

/** Enregistre la réponse (une seule par compte). */
export const submitOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { source: string; otherText?: string }) =>
    z
      .object({
        source: z.enum(["youtube", "tiktok", "facebook", "google", "gemini", "other", "ignore"]),
        otherText: z.string().trim().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const email = typeof context.claims["email"] === "string" ? context.claims["email"] : null;
    const { error } = await (context.supabase as unknown as AnyClient)
      .from("onboarding_responses")
      .upsert(
        {
          user_id: context.userId,
          email,
          source: data.source,
          other_text: data.source === "other" ? (data.otherText ?? null) : null,
        },
        { onConflict: "user_id", ignoreDuplicates: true },
      );
    if (error) return { ok: false as const, message: "Envoi impossible pour le moment." };
    return { ok: true as const };
  });

/** Bureau d'administration : toutes les réponses + statistiques par source. */
export const listOnboardingResponses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnboardingReport> => {
    const claims = context.claims as { email?: unknown } | null;
    const email = typeof claims?.email === "string" ? claims.email.toLowerCase().trim() : "";
    if (!(email && OWNER_EMAILS.includes(email))) {
      const { data, error } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (error || data !== true) throw new Error("Accès refusé");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as unknown as AnyClient)
      .from("onboarding_responses")
      .select("user_id, email, source, other_text, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    const items = (data ?? []) as OnboardingResponse[];
    const counts: Record<string, number> = {};
    for (const r of items) counts[r.source] = (counts[r.source] ?? 0) + 1;
    return { total: items.length, counts, items };
  });
