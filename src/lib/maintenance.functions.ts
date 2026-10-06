import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAILS } from "@/lib/owners";

export type MaintenanceState = { enabled: boolean; message: string | null };

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

/** État public du mode maintenance (lu par tous les visiteurs). En cas d'erreur : service ouvert. */
export const getMaintenance = createServerFn({ method: "GET" }).handler(
  async (): Promise<MaintenanceState> => {
    try {
      const { data, error } = await publicClient()
        .from("app_settings")
        .select("maintenance_enabled, maintenance_message")
        .eq("id", "global")
        .maybeSingle();
      if (error || !data) return { enabled: false, message: null };
      return {
        enabled: Boolean(data.maintenance_enabled),
        message: (data.maintenance_message as string | null) ?? null,
      };
    } catch {
      return { enabled: false, message: null };
    }
  },
);

/** Active / coupe le mode maintenance (administrateur uniquement). */
export const setMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { enabled: boolean; message?: string }) =>
    z
      .object({ enabled: z.boolean(), message: z.string().trim().max(400).optional() })
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
    const { error } = await (supabaseAdmin as unknown as AnyClient)
      .from("app_settings")
      .update({
        maintenance_enabled: data.enabled,
        maintenance_message: data.message ? data.message : null,
      })
      .eq("id", "global");
    if (error) {
      return {
        ok: false as const,
        message: "Enregistrement impossible. Le script SQL a-t-il été exécuté dans Supabase ?",
      };
    }
    return { ok: true as const };
  });
