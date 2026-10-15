import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { activePlan } from "@/lib/services/access.server";

/**
 * Indique si l'accueil de parcours doit s'afficher :
 * - aux personnes sans abonnement actif (jamais abonnées, ou abonnement terminé) ;
 * - à l'administrateur, pour qu'il voie exactement ce que voient les clients.
 */
export const getWelcomeGate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ plan }, adminRes] = await Promise.all([
      activePlan(context.userId),
      supabaseAdmin.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    ]);
    const isAdmin = adminRes.data === true;
    const hasActiveSub = plan !== "free";
    return { show: !hasActiveSub || isAdmin, isAdmin };
  });
