import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Notifications push : chiffres et envoi depuis le bureau administrateur. Réservé aux administrateurs. */

async function assertAdmin(context: { userId: string; supabase: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = context.supabase as any;
  const { data, error } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || data !== true) throw new Error("Accès refusé");
}

/** Combien d'appareils et d'utilisateurs ont activé les notifications, et combien d'inscrits il y a. */
export const adminPushStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("user_id").limit(100000);
    const users = new Set((subs ?? []).map((s) => s.user_id as string));
    const { count: totalUsers } = await supabaseAdmin.from("profiles").select("id", { count: "exact", head: true });
    return {
      devices: subs?.length ?? 0,
      usersWithPush: users.size,
      totalUsers: totalUsers ?? 0,
      vapidReady: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    };
  });

/** Envoie une notification à tous les appareils qui ont activé les notifications. */
export const adminSendPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().trim().min(3).max(80),
        body: z.string().trim().min(5).max(240),
        url: z.string().trim().max(200).default("/app"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { sendPushToUsers } = await import("@/lib/push.server");
    const res = await sendPushToUsers(null, data.title, data.body, data.url);
    return res;
  });
