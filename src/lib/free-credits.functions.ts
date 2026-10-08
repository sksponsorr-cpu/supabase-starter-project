import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAILS } from "@/lib/owners";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (t: string) => any };

export const getFreeCreditMode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as unknown as AnyClient)
      .from("app_settings")
      .select("free_lifetime_mode")
      .eq("id", "global")
      .maybeSingle();
    return { lifetime: data?.free_lifetime_mode !== false };
  });

export const setFreeCreditMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lifetime: boolean }) => z.object({ lifetime: z.boolean() }).parse(input))
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
      .update({ free_lifetime_mode: data.lifetime })
      .eq("id", "global");
    if (error) {
      return { ok: false as const, message: "Enregistrement impossible. Le script SQL a-t-il été exécuté ?" };
    }
    return { ok: true as const };
  });
