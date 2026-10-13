import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAILS } from "@/lib/owners";

export type VoiceProvider = "kie" | "fal";

/** Lit le fournisseur de voix off (KIE par défaut). Accessible à tous, sans secret. */
export const getVoiceProvider = createServerFn({ method: "GET" }).handler(async (): Promise<VoiceProvider> => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("voice_provider")
      .eq("id", "global")
      .maybeSingle();
    return (data as { voice_provider?: string } | null)?.voice_provider === "fal" ? "fal" : "kie";
  } catch {
    return "kie";
  }
});

/** Change le fournisseur de voix off. Administrateur uniquement. */
export const setVoiceProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { provider: VoiceProvider }) => z.object({ provider: z.enum(["kie", "fal"]) }).parse(input))
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
    const { error } = await (supabaseAdmin as unknown as { from: (t: string) => any })
      .from("app_settings")
      .update({ voice_provider: data.provider })
      .eq("id", "global");
    if (error) {
      return { ok: false as const, message: "Enregistrement impossible. Le script SQL a-t-il été exécuté ?" };
    }
    return { ok: true as const };
  });
