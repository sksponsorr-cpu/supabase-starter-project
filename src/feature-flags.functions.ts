import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAILS } from "@/lib/owners";
import { FEATURE_KEYS, parseFeatureFlags, type FeatureFlags } from "@/lib/feature-flags";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (t: string) => any };

function publicClient(): AnyClient {
  const key = (process.env["SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["EXTERNAL_SUPABASE_ANON_KEY"] ??
    process.env["SUPABASE_ANON_KEY"])!;
  return createClient((process.env["SUPABASE_URL"] ?? process.env["EXTERNAL_SUPABASE_URL"])!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  }) as unknown as AnyClient;
}

/** Interrupteurs publics (lus par tous). En cas d'erreur : tout masqué. */
export const getFeatureFlags = createServerFn({ method: "GET" }).handler(
  async (): Promise<FeatureFlags> => {
    try {
      const { data, error } = await publicClient()
        .from("app_settings")
        .select("feature_flags")
        .eq("id", "global")
        .maybeSingle();
      if (error || !data) return {};
      return parseFeatureFlags(data.feature_flags);
    } catch {
      return {};
    }
  },
);

/** Publie ou masque une fonctionnalité (administrateur uniquement). */
export const setFeatureFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { key: string; enabled: boolean }) =>
    z
      .object({
        key: z.enum(FEATURE_KEYS as unknown as [string, ...string[]]),
        enabled: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const claims = context.claims as { email?: unknown } | null;
    const email = typeof claims?.email === "string" ? claims.email.toLowerCase().trim() : "";
    if (!(email && OWNER_EMAILS.includes(email))) {
      const { data: isAdmin } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (isAdmin !== true) throw new Error("Accès refusé");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as AnyClient;

    const { data: row, error: readErr } = await client
      .from("app_settings")
      .select("feature_flags")
      .eq("id", "global")
      .maybeSingle();
    if (readErr) {
      return { ok: false as const, message: "Lecture impossible. Le script SQL a-t-il été exécuté ?" };
    }
    const flags = { ...parseFeatureFlags(row?.feature_flags), [data.key]: data.enabled };

    const { error } = await client
      .from("app_settings")
      .update({ feature_flags: flags })
      .eq("id", "global");
    if (error) {
      return { ok: false as const, message: "Enregistrement impossible. Le script SQL a-t-il été exécuté ?" };
    }
    return { ok: true as const, flags };
  });
