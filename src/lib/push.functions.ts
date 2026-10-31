import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Enregistre l'appareil de l'utilisateur pour les notifications push. */
export const savePushSubscription = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        endpoint: z.string().url().max(2000),
        p256dh: z.string().min(10).max(300),
        auth: z.string().min(5).max(300),
      })
      .parse(raw),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const { error } = await db
      .from("push_subscriptions")
      .upsert({ user_id: context.userId, endpoint: data.endpoint, p256dh: data.p256dh, auth: data.auth }, { onConflict: "endpoint" });
    if (error) return { ok: false as const, message: "Enregistrement impossible. Réessaie." };
    return { ok: true as const };
  });

/** Clé publique VAPID exposée au navigateur (aucun secret ici). */
export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env.VAPID_PUBLIC_KEY ?? "" };
});
