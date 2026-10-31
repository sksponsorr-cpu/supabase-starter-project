import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { getModelSwitches, setModelSwitch } from "@/lib/model-switches.functions";
import { CREATOR_MODELS } from "@/lib/creator-models";
import { toast } from "@/lib/toast";

/** Désactiver un modèle affiche son message à l'utilisateur avant génération. */
export function AdminModelSwitchesPanel() {
  const load = useServerFn(getModelSwitches);
  const save = useServerFn(setModelSwitch);
  const models = CREATOR_MODELS.filter((m) => m.live);
  const [disabled, setDisabled] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    load()
      .then((res) => {
        if (res.ok) {
          setDisabled(res.disabled);
          setMessages(res.disabled);
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = async (modelId: string, enabled: boolean) => {
    setBusyId(modelId);
    try {
      const res = await save({ data: { modelId, enabled, message: messages[modelId] ?? "" } });
      if (!res.ok) return toast.error(res.message);
      setDisabled(res.disabled);
      toast.success(enabled ? "Modèle réactivé." : "Modèle désactivé.");
    } catch {
      toast.error("Action impossible pour le moment.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="pt-5">
      <h2 className="text-[22px] font-semibold tracking-tight">Modèles</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Désactive un modèle pour la maintenance. L'utilisateur voit le message avant de générer, et peut choisir un autre modèle.
      </p>
      {loading && <p className="mt-4 text-sm text-muted-foreground">Chargement…</p>}
      <div className="mt-4 space-y-3">
        {models.map((m) => {
          const off = Object.prototype.hasOwnProperty.call(disabled, m.id);
          return (
            <div key={m.id} className="rounded-3xl border border-border/70 bg-card/50 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[15px] font-semibold">{m.label}</p>
                <span className={`text-xs font-medium ${off ? "text-red-400" : "text-emerald-400"}`}>{off ? "Désactivé" : "Actif"}</span>
              </div>
              <textarea
                className="mt-3 w-full rounded-2xl border border-border bg-background p-3 text-sm"
                rows={2}
                maxLength={300}
                placeholder="Message affiché à l'utilisateur (ex. Maintenance en cours, essayez Grok ou VEO 3)"
                value={messages[m.id] ?? ""}
                onChange={(e) => setMessages({ ...messages, [m.id]: e.target.value })}
              />
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={busyId === m.id} onClick={() => void apply(m.id, false)} className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-60">
                  {busyId === m.id && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}
                  Désactiver
                </button>
                <button type="button" disabled={busyId === m.id || !off} onClick={() => void apply(m.id, true)} className="rounded-full bg-secondary px-5 py-2.5 text-sm font-medium disabled:opacity-60">
                  Réactiver
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
