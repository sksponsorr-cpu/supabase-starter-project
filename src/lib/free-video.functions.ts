import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAILS } from "@/lib/owners";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (t: string) => any };

/** Lit l'option « vidéos pour les gratuits » (désactivée par défaut). */
export const getFreeVideoMode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as unknown as AnyClient)
      .from("app_settings")
      .select("free_video_enabled")
      .eq("id", "global")
      .maybeSingle();
    return { enabled: data?.free_video_enabled === true };
  });

/** Active ou désactive les vidéos de 5 secondes pour les gratuits (admin uniquement). */
export const setFreeVideoMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { enabled: boolean }) => z.object({ enabled: z.boolean() }).parse(input))
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
      .update({ free_video_enabled: data.enabled })
      .eq("id", "global");
    if (error) return { ok: false as const, message: "Enregistrement impossible." };
    return { ok: true as const };
  });
