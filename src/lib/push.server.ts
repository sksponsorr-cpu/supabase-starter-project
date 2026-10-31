// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (t: string) => any };

/**
 * Envoie une notification push aux appareils des utilisateurs (tous, ou la liste donnée).
 * Nécessite VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT et le paquet « web-push ».
 * Sans configuration, ne fait rien et ne bloque jamais l'envoi des notifications in-app.
 */
export async function sendPushToUsers(
  userIds: string[] | null,
  title: string,
  body: string,
  url = "/",
): Promise<{ sent: number; skipped: boolean }> {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:contact@sam-flash.lat";
  if (!publicKey || !privateKey) return { sent: 0, skipped: true };

  let webpush: { setVapidDetails: (...a: string[]) => void; sendNotification: (...a: unknown[]) => Promise<unknown> };
  try {
    // Import dynamique : le build ne casse pas si le paquet n'est pas encore installé.
    // @ts-expect-error paquet optionnel, installé avec « npm install web-push »
    webpush = (await import("web-push")).default ?? (await import("web-push"));
  } catch {
    return { sent: 0, skipped: true };
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as AnyClient;
  let query = db.from("push_subscriptions").select("id, endpoint, p256dh, auth");
  if (userIds) query = query.in("user_id", userIds);
  const { data } = await query.limit(5000);
  const subs = (data ?? []) as { id: string; endpoint: string; p256dh: string; auth: string }[];

  const payload = JSON.stringify({ title, body, url });
  let sent = 0;
  for (let i = 0; i < subs.length; i += 50) {
    const batch = subs.slice(i, i + 50);
    const results = await Promise.allSettled(
      batch.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)),
    );
    results.forEach((r, idx) => {
      if (r.status === "fulfilled") sent += 1;
      else {
        const code = (r.reason as { statusCode?: number })?.statusCode;
        // 404 / 410 : l'appareil a retiré l'autorisation, on supprime l'abonnement.
        if (code === 404 || code === 410) void db.from("push_subscriptions").delete().eq("id", batch[idx].id);
      }
    });
  }
  return { sent, skipped: false };
}
