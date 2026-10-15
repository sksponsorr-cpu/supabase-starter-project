import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_CREDIT_CONFIG, mergeCreditConfig, type CreditConfig } from "@/lib/credits";
import { clearCreditConfigCache } from "@/lib/credits.server";

/** Vérifie que l'utilisateur est propriétaire ou administrateur. Même règle que la page d'accueil. */
async function assertCreditsAdmin(context: {
  claims?: unknown;
  userId: string;
  supabase: { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
}) {
  const { OWNER_EMAILS } = await import("@/lib/owners");
  const claims = context.claims as { email?: unknown } | null;
  const email = typeof claims?.email === "string" ? claims.email.toLowerCase().trim() : "";
  if (email && OWNER_EMAILS.includes(email)) return;
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (data !== true) throw new Error("Accès refusé");
}

const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

/** Nettoie les valeurs envoyées par le panneau : bornes raisonnables, aucun champ inconnu. */
function clean(raw: unknown): CreditConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const v = (r["videoPerSecond"] ?? {}) as Record<string, unknown>;
  return {
    videoPerSecond: {
      "480p": num(v["480p"], 1, 500, DEFAULT_CREDIT_CONFIG.videoPerSecond["480p"]),
      "720p": num(v["720p"], 1, 500, DEFAULT_CREDIT_CONFIG.videoPerSecond["720p"]),
      "1080p": num(v["1080p"], 1, 800, DEFAULT_CREDIT_CONFIG.videoPerSecond["1080p"]),
    },
    cloneVideoPerSecond: num(r["cloneVideoPerSecond"], 1, 1000, DEFAULT_CREDIT_CONFIG.cloneVideoPerSecond),
    imageCost: num(r["imageCost"], 1, 100, DEFAULT_CREDIT_CONFIG.imageCost),
    feeRate: num(r["feeRate"], 0, 0.5, DEFAULT_CREDIT_CONFIG.feeRate),
    cloneProvider: r["cloneProvider"] === "fal" ? "fal" : "kie",
  };
}

/** Lit la configuration actuelle des crédits pour le panneau administrateur. */
export const getCreditSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCreditsAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const { data } = await db.from("app_settings").select("credit_config").eq("id", "global").maybeSingle();
    return { config: mergeCreditConfig(data?.credit_config ?? null), defaults: DEFAULT_CREDIT_CONFIG };
  });

/** Enregistre la configuration des crédits. Effective dans la minute (cache de 60 s). */
export const setCreditSettings = createServerFn({ method: "POST" })
  .validator((input: unknown) => clean(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertCreditsAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const { error } = await db.from("app_settings").upsert({ id: "global", credit_config: data });
    if (error) return { ok: false as const, message: `Enregistrement impossible : ${error.message}` };
    clearCreditConfigCache();
    return { ok: true as const };
  });
