import { OWNER_EMAILS } from "@/lib/owners";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (t: string) => any; rpc: (...a: any[]) => any };

/**
 * Bloque côté serveur les actions coûteuses (génération) quand le mode
 * maintenance est actif. Les propriétaires et administrateurs passent toujours.
 */
export async function assertServiceAvailable(
  userId: string,
  claims: Record<string, unknown> | null | undefined,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as AnyClient;
    const { data } = await db
      .from("app_settings")
      .select("maintenance_enabled")
      .eq("id", "global")
      .maybeSingle();
    if (!data?.maintenance_enabled) return;

    const email = typeof claims?.["email"] === "string" ? (claims["email"] as string).toLowerCase().trim() : "";
    if (email && OWNER_EMAILS.includes(email)) return;
    const { data: isAdmin } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (isAdmin === true) return;
  } catch {
    // En cas de doute (colonne absente, réseau…), on laisse le service ouvert.
    return;
  }
  throw new Error("Sam flash est en maintenance. Réessayez dans quelques instants.");
}
