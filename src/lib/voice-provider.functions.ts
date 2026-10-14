import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAILS } from "@/lib/owners";

export type VoiceProvider = "kie" | "fal";
export type CodeProvider = "kie" | "fal";

async function readSetting(column: string): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("app_settings").select(column).eq("id", "global").maybeSingle();
    return ((data as unknown) as Record<string, string> | null)?.[column] ?? null;
  } catch {
    return null;
  }
}

/** Fournisseur de voix off (KIE par défaut). */
export const getVoiceProvider = createServerFn({ method: "GET" }).handler(async (): Promise<VoiceProvider> => {
  return (await readSetting("voice_provider")) === "fal" ? "fal" : "kie";
});

/** Fournisseur des modèles de création (KIE par défaut). */
export const getCodeProvider = createServerFn({ method: "GET" }).handler(async (): Promise<CodeProvider> => {
  return (await readSetting("code_provider")) === "fal" ? "fal" : "kie";
});

async function assertAdmin(context: { claims: unknown; userId: string; supabase: any }) {
  const claims = context.claims as { email?: unknown } | null;
  const email = typeof claims?.email === "string" ? claims.email.toLowerCase().trim() : "";
  if (email && OWNER_EMAILS.includes(email)) return;
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (isAdmin !== true) throw new Error("Accès refusé");
}

async function writeSetting(column: string, value: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await (supabaseAdmin as unknown as { from: (t: string) => any })
    .from("app_settings")
    .update({ [column]: value })
    .eq("id", "global");
  return error;
}

export const setVoiceProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { provider: VoiceProvider }) => z.object({ provider: z.enum(["kie", "fal"]) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const error = await writeSetting("voice_provider", data.provider);
    return error ? { ok: false as const, message: "Enregistrement impossible. Le script SQL a-t-il été exécuté ?" } : { ok: true as const };
  });

export const setCodeProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { provider: CodeProvider }) => z.object({ provider: z.enum(["kie", "fal"]) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const error = await writeSetting("code_provider", data.provider);
    return error ? { ok: false as const, message: "Enregistrement impossible. Le script SQL a-t-il été exécuté ?" } : { ok: true as const };
  });
