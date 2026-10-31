import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAILS } from "@/lib/owners";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (t: string) => any; rpc: (...a: any[]) => any };

export const getModelSwitches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as unknown as AnyClient)
      .from("app_settings")
      .select("disabled_models")
      .eq("id", "global")
      .maybeSingle();
    if (error) return { ok: false as const, message: "Lecture impossible." };
    return { ok: true as const, disabled: (data?.disabled_models ?? {}) as Record<string, string> };
  });

export const setModelSwitch = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        modelId: z.string().min(1).max(60),
        enabled: z.boolean(),
        message: z.string().trim().max(300).default(""),
      })
      .parse(raw),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const claims = context.claims as { email?: unknown } | null;
    const email = typeof claims?.email === "string" ? claims.email.toLowerCase().trim() : "";
    if (!(email && OWNER_EMAILS.includes(email))) {
      const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
      if (isAdmin !== true) throw new Error("Accès refusé");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as AnyClient;
    const { data: row, error: readErr } = await db
      .from("app_settings")
      .select("disabled_models")
      .eq("id", "global")
      .maybeSingle();
    if (readErr) return { ok: false as const, message: "Lecture impossible." };
    const map = { ...((row?.disabled_models ?? {}) as Record<string, string>) };
    if (data.enabled) delete map[data.modelId];
    else map[data.modelId] = data.message || "Ce modèle est temporairement indisponible. Essaie un autre modèle.";
    const { error } = await db.from("app_settings").update({ disabled_models: map }).eq("id", "global");
    if (error) return { ok: false as const, message: "Enregistrement impossible. La migration a-t-elle été exécutée ?" };
    return { ok: true as const, disabled: map };
  });
