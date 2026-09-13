import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Enregistre l'appareil du visiteur et indique si l'offre gratuite y a déjà
 * été consommée par un autre compte.
 */
export const registerDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ fingerprint: z.string().min(6).max(120) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("user_devices")
      .upsert(
        { user_id: context.userId, fingerprint: data.fingerprint },
        { onConflict: "user_id,fingerprint" },
      );

    const { data: existing } = await supabaseAdmin
      .from("device_fingerprints")
      .select("first_user_id")
      .eq("fingerprint", data.fingerprint)
      .maybeSingle();

    if (!existing) {
      await supabaseAdmin
        .from("device_fingerprints")
        .insert({ fingerprint: data.fingerprint, first_user_id: context.userId, free_used: true });
      return { ok: true as const, freeBlocked: false };
    }

    return { ok: true as const, freeBlocked: existing.first_user_id !== context.userId };
  });

/** État d'accès à la génération (formule, quota restant, appareil). */
export const getGenerationAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        mediaType: z.enum(["image", "video"]).default("video"),
        seconds: z.number().int().min(0).max(60).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { checkGenerationAccess } = await import("@/lib/services/access.server");
    return await checkGenerationAccess(context.userId, data.mediaType, data.seconds);
  });
