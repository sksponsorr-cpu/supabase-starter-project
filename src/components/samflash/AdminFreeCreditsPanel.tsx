import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Coins } from "lucide-react";
import { getFreeCreditMode, setFreeCreditMode } from "@/lib/free-credits.functions";
import { toast } from "@/lib/toast";

/** Interrupteur : 5 crédits offerts à l'inscription (activé) ou aucun crédit (désactivé). */
export function AdminFreeCreditsPanel() {
  const fetchMode = useServerFn(getFreeCreditMode);
  const save = useServerFn(setFreeCreditMode);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchMode()
      .then((s) => setEnabled(s.lifetime))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [fetchMode]);

  const apply = async (next: boolean) => {
    setBusy(true);
    try {
      const res = await save({ data: { lifetime: next } });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setEnabled(next);
      toast.success(next ? "Crédits gratuits activés." : "Crédits gratuits désactivés.");
    } catch {
      toast.error("Action impossible pour le moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="pt-5">
      <h2 className="text-[22px] font-semibold tracking-tight">Crédits gratuits</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Les nouveaux comptes gratuits reçoivent 5 crédits d'image. Les abonnés ne sont pas concernés.
      </p>

      <div className="mt-4 rounded-3xl border border-border/70 bg-card/50 p-5 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Coins className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">
              {loading ? "Chargement…" : enabled ? "Activés" : "Désactivés"}
            </p>
            <p className="text-sm text-muted-foreground">
              {enabled
                ? "5 crédits à l'inscription, 3 comptes maximum par téléphone et par adresse IP."
                : "Aucun crédit offert aux nouveaux comptes. Les comptes déjà créés ne sont pas touchés."}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || loading || enabled}
            onClick={() => void apply(true)}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-[14px] font-semibold text-background disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Activer
          </button>
          <button
            type="button"
            disabled={busy || loading || !enabled}
            onClick={() => void apply(false)}
            className="rounded-full bg-secondary px-5 py-3 text-[13px] font-medium disabled:opacity-60"
          >
            Désactiver
          </button>
        </div>
      </div>
    </section>
  );
}
