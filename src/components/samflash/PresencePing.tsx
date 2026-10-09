import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { pingPresence } from "@/lib/presence.functions";

/** Signale toutes les 60 s que l'utilisateur connecté est présent (onglet visible uniquement). */
export function PresencePing() {
  const { session } = useAuth();
  const ping = useServerFn(pingPresence);

  useEffect(() => {
    if (!session) return;
    const send = () => {
      if (document.visibilityState === "visible") void ping({}).catch(() => {});
    };
    send();
    const id = window.setInterval(send, 60_000);
    document.addEventListener("visibilitychange", send);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", send);
    };
  }, [session, ping]);

  return null;
}
