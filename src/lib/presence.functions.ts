import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Marque l'utilisateur connecté comme « vu à l'instant » (affiché dans le bureau d'administration). */
export const pingPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin.from("profiles") as any)
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", context.userId);
    return { ok: true as const };
  });
