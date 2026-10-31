import { OWNER_EMAILS } from "@/lib/owners";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (t: string) => any };

/** Message à afficher si le modèle est désactivé, sinon null. Fail-open si la lecture échoue. */
export async function modelBlockMessage(modelId: string): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as unknown as AnyClient)
      .from("app_settings")
      .select("disabled_models")
      .eq("id", "global")
      .maybeSingle();
    const map = (data?.disabled_models ?? {}) as Record<string, string>;
    if (!Object.prototype.hasOwnProperty.call(map, modelId)) return null;
    return map[modelId] || "Ce modèle est temporairement indisponible. Essaie un autre modèle.";
  } catch {
    return null;
  }
}
