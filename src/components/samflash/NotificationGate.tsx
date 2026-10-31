import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { savePushSubscription, getVapidPublicKey } from "@/lib/push.functions";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * Étape obligatoire après l'inscription : l'utilisateur doit activer les notifications
 * pour accéder à l'application. Le navigateur demande l'autorisation ; si elle est refusée,
 * l'étape reste affichée avec la marche à suivre pour la réactiver.
 */
export function NotificationGate() {
  const saveSub = useServerFn(savePushSubscription);
  const getKey = useServerFn(getVapidPublicKey);
  const [done, setDone] = useState<boolean | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  useEffect(() => {
    if (!supported) return setDone(true); // Navigateur sans push : on ne bloque pas.
    if (Notification.permission === "granted") {
      void navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setDone(!!sub))
        .catch(() => setDone(false));
    } else {
      setDone(false);
      setDenied(Notification.permission === "denied");
    }
  }, [supported]);

  const activate = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setDenied(permission === "denied");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const { key } = await getKey();
      if (!key) throw new Error("Notifications non configurées.");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
      const json = sub.toJSON();
      const res = await saveSub({
        data: { endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
      });
      if (res.ok) setDone(true);
    } catch {
      setDone(false);
    } finally {
      setBusy(false);
    }
  };

  if (done !== false || skipped) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 px-6" role="dialog" aria-modal="true" aria-label="Activer les notifications">
      <div className="w-full max-w-sm rounded-3xl bg-background p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Bell className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-lg font-bold">Activez les notifications</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Pour continuer, activez les notifications : vous serez prévenu des nouveautés, des offres et de l'état de vos paiements.
        </p>
        {denied ? (
          <p className="mt-4 rounded-2xl bg-red-500/10 p-3 text-xs text-red-300">
            Les notifications sont bloquées dans votre navigateur. Ouvrez les réglages du site (cadenas dans la barre d'adresse), autorisez les notifications, puis rechargez la page.
          </p>
        ) : (
          <button type="button" disabled={busy} onClick={() => void activate()} className="mt-5 w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? "Activation…" : "Activer les notifications"}
          </button>
        )}
        <button type="button" onClick={() => setSkipped(true)} className="mt-3 w-full py-2 text-xs text-muted-foreground underline">
          Ignorer pour l'instant
        </button>
      </div>
    </div>
  );
}
