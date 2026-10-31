import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAILS } from "@/lib/owners";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (t: string) => any; rpc: (...a: any[]) => any };

/** Notifications de l'utilisateur connecté (les 30 plus récentes et le nombre non lu). */
export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as AnyClient;
    const { data, error } = await db
      .from("user_notifications")
      .select("id, kind, title, body, created_at, read_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) return { ok: false as const, message: "Notifications indisponibles pour le moment." };
    const rows = (data ?? []) as { read_at: string | null }[];
    return { ok: true as const, items: rows, unread: rows.filter((r) => !r.read_at).length };
  });

/** Marque toutes les notifications de l'utilisateur comme lues. */
export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as AnyClient;
    const { error } = await db
      .from("user_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("read_at", null);
    if (error) return { ok: false as const, message: "Action impossible." };
    return { ok: true as const };
  });

/** Envoi administrateur : à un utilisateur (par son identifiant) ou à tous. */
export const sendNotification = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        userId: z.string().uuid().nullable(),
        kind: z.enum(["info", "nouveaute", "offre", "modele", "abonnement", "maintenance", "payment_reminder", "payment_action"]),
        title: z.string().trim().min(2).max(120),
        body: z.string().trim().min(2).max(600),
      })
      .parse(raw),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const claims = context.claims as { email?: unknown } | null;
    const email = typeof claims?.email === "string" ? claims.email.toLowerCase().trim() : "";
    if (!(email && OWNER_EMAILS.includes(email))) {
      const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
      if (isAdmin !== true) throw new Error("Accès refusé");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as AnyClient;
    let targets: { id: string }[];
    if (data.userId) {
      targets = [{ id: data.userId }];
    } else {
      const { data: all, error } = await db.from("profiles").select("id");
      if (error) return { ok: false as const, message: "Lecture des comptes impossible." };
      targets = (all ?? []) as { id: string }[];
    }
    if (targets.length === 0) return { ok: false as const, message: "Aucun destinataire." };
    const rows = targets.map((t) => ({ user_id: t.id, kind: data.kind, title: data.title, body: data.body }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from("user_notifications").insert(rows.slice(i, i + 500));
      if (error) return { ok: false as const, message: "Envoi incomplet. Réessayez." };
    }
    const { sendPushToUsers } = await import("@/lib/push.server");
    const push = await sendPushToUsers(data.userId ? [data.userId] : null, data.title, data.body);
    return { ok: true as const, sent: rows.length, pushed: push.sent, pushSkipped: push.skipped };
  });
