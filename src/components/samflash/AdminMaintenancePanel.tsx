import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck, Wrench } from "lucide-react";
import { getMaintenance, setMaintenance } from "@/lib/maintenance.functions";
import { toast } from "@/lib/toast";

const DEFAULT_MESSAGE =
  "Nous améliorons Sam flash. Le service sera de retour dans quelques instants.";

/** Bouton d'urgence : coupe l'application pour les utilisateurs (l'équipe garde l'accès). */
export function AdminMaintenancePanel() {
  const fetchState = useServerFn(getMaintenance);
  const save = useServerFn(setMaintenance);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    void fetchState()
      .then((s) => {
        setEnabled(s.enabled);
        setMessage(s.message ?? "");
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [fetchState]);

  const apply = async (next: boolean) => {
    setBusy(true);
    try {
      const res = await save({ data: { enabled: next, message } });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setEnabled(next);
      setConfirming(false);
      toast.success(next ? "Mode maintenance activé." : "Service rétabli.");
    } catch {
      toast.error("Action impossible pour le moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="pt-5">
      <h2 className="text-[22px] font-semibold tracking-tight">Mode maintenance</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Coupez le service en un clic pour déployer une mise à jour ou corriger un bug.
      </p>

      <div
        className={`mt-4 rounded-3xl border p-5 backdrop-blur-xl ${
          enabled ? "border-amber-500/50 bg-amber-500/10" : "border-border/70 bg-card/50"
        }`}
      >
        <div className="flex items-center gap-4">
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
              enabled ? "bg-amber-500/20 text-amber-500" : "bg-emerald-500/15 text-emerald-500"
            }`}
          >
            <Wrench className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">
              {loading ? "Chargement…" : enabled ? "Application en maintenance" : "Application en ligne"}
            </p>
            <p className="text-sm text-muted-foreground">
              {enabled
                ? "Les utilisateurs voient la page de maintenance. Les générations sont bloquées."
                : "Tout fonctionne normalement pour vos utilisateurs."}
            </p>
          </div>
        </div>

        <label className="mt-5 block text-[13px] font-medium" htmlFor="maintenance-message">
          Message affiché aux utilisateurs
        </label>
        <textarea
          id="maintenance-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={400}
          placeholder={DEFAULT_MESSAGE}
          className="mt-2 w-full resize-none rounded-2xl border border-border bg-background/60 px-3.5 py-3 text-[14px] outline-none focus:border-primary/60"
        />

        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Vous et votre équipe gardez l'accès à l'application et au bureau d'administration.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {enabled ? (
            <>
              <button
                type="button"
                disabled={busy || loading}
                onClick={() => void apply(false)}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-[14px] font-semibold text-white disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Rétablir le service
              </button>
              <button
                type="button"
                disabled={busy || loading}
                onClick={() => void apply(true)}
                className="rounded-full bg-secondary px-5 py-3 text-[13px] font-medium disabled:opacity-60"
              >
                Mettre à jour le message
              </button>
            </>
          ) : confirming ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void apply(true)}
                className="inline-flex items-center gap-2 rounded-full bg-destructive px-6 py-3 text-[14px] font-semibold text-destructive-foreground disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Oui, couper le service
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-full bg-secondary px-5 py-3 text-[13px] font-medium"
              >
                Annuler
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={() => setConfirming(true)}
              className="rounded-full bg-foreground px-6 py-3 text-[14px] font-semibold text-background disabled:opacity-60"
            >
              Activer la maintenance
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
