import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getFreeVideoMode, setFreeVideoMode } from "@/lib/free-video.functions";

/** Interrupteur : vidéos de 5 secondes pour les utilisateurs gratuits (10 crédits). */
export function AdminFreeVideoPanel() {
  const load = useServerFn(getFreeVideoMode);
  const save = useServerFn(setFreeVideoMode);
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    load()
      .then((r) => setEnabled(r.enabled))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, [load]);

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next);
    const res = await save({ data: { enabled: next } });
    setNotice(res.ok ? (next ? "Vidéos gratuites activées (5 s)." : "Vidéos gratuites désactivées.") : res.message);
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border p-4">
      <h3 className="text-base font-semibold">Vidéos pour les utilisateurs gratuits</h3>
      <p className="text-xs text-muted-foreground">
        Activé : le gratuit peut générer une vidéo de 5 secondes avec ses 10 crédits. Quand les crédits sont épuisés, un message l'invite à passer à une offre supérieure.
      </p>
      <button
        type="button"
        disabled={!loaded}
        onClick={() => void toggle()}
        className={`w-full rounded-full py-3 text-sm font-semibold ${enabled ? "bg-primary text-primary-foreground" : "border border-border"}`}
      >
        {!loaded ? "Chargement…" : enabled ? "Activé : désactiver" : "Désactivé : activer"}
      </button>
      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
    </section>
  );
}
