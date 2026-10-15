import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { type CreditConfig, mergeCreditConfig } from "@/lib/credits";

let cache: { value: CreditConfig; at: number } | null = null;
const TTL_MS = 60_000;

/**
 * Lit la configuration des crédits enregistrée par l'administrateur (table app_settings, ligne "global").
 * Mise en cache 60 s pour ne pas interroger la base à chaque génération.
 */
export async function getCreditConfig(): Promise<CreditConfig> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("credit_config")
    .eq("id", "global")
    .maybeSingle();
  const value = mergeCreditConfig((data?.credit_config as Partial<CreditConfig>) ?? null);
  cache = { value, at: Date.now() };
  return value;
}

/** À appeler après une modification dans le panneau administrateur. */
export function clearCreditConfigCache() {
  cache = null;
}
