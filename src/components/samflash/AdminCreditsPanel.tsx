import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getCreditSettings, setCreditSettings } from "@/lib/credits-admin.functions";
import { creditCostFor, type CreditConfig } from "@/lib/credits";
import { toast } from "@/lib/toast";

const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const label = "mb-1 block text-xs font-medium text-muted-foreground";

export function AdminCreditsPanel() {
  const fetchSettings = useServerFn(getCreditSettings);
  const save = useServerFn(setCreditSettings);
  const [config, setConfig] = useState<CreditConfig | null>(null);
  const [defaults, setDefaults] = useState<CreditConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings()
      .then((res) => {
        setConfig(res.config);
        setDefaults(res.defaults);
      })
      .catch(() => toast.error("Impossible de charger les réglages des crédits."));
  }, [fetchSettings]);

  if (!config || !defaults) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  const num = (v: string) => (v === "" ? 0 : Number(v));

  const onSave = async () => {
    setSaving(true);
    try {
      const res = await save({ data: config });
      if (res.ok) toast.success("Réglages enregistrés. Effectifs dans la minute.");
      else toast.error(res.message);
    } catch {
      toast.error("Erreur pendant l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const onReset = () => setConfig(defaults);

  // Aperçu en direct : coût d'une vidéo de 5 secondes et d'une minute
  const preview = (res: "480p" | "720p" | "1080p") => ({
    five: creditCostFor("video", 5, res, config),
    minute: creditCostFor("video", 60, res, config),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Crédits</h2>
        <p className="text-sm text-muted-foreground">
          Modifiez les valeurs ici. Les clients voient le résultat, jamais la marge.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        {(["480p", "720p", "1080p"] as const).map((res) => (
          <div key={res}>
            <label className={label}>Crédits par seconde · {res}</label>
            <input
              className={field}
              type="number"
              min={1}
              value={config.videoPerSecond[res]}
              onChange={(e) =>
                setConfig({ ...config, videoPerSecond: { ...config.videoPerSecond, [res]: num(e.target.value) } })
              }
            />
          </div>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={label}>Crédits par seconde · clonage vidéo</label>
          <input
            className={field}
            type="number"
            min={1}
            value={config.cloneVideoPerSecond}
            onChange={(e) => setConfig({ ...config, cloneVideoPerSecond: num(e.target.value) })}
          />
        </div>
        <div>
          <label className={label}>Crédits par image</label>
          <input
            className={field}
            type="number"
            min={1}
            value={config.imageCost}
            onChange={(e) => setConfig({ ...config, imageCost: num(e.target.value) })}
          />
        </div>
        <div>
          <label className={label}>Frais affichés (%)</label>
          <input
            className={field}
            type="number"
            step="0.1"
            min={0}
            value={+(config.feeRate * 100).toFixed(2)}
            onChange={(e) => setConfig({ ...config, feeRate: num(e.target.value) / 100 })}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border p-4">
        <p className="mb-2 text-sm font-medium">Aperçu</p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {(["480p", "720p", "1080p"] as const).map((res) => (
            <li key={res}>
              {res} : vidéo de 5 s = <strong className="text-foreground">{preview(res).five}</strong> crédits ·
              1 min = <strong className="text-foreground">{preview(res).minute}</strong> crédits
            </li>
          ))}
        </ul>
      </section>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" onClick={onReset} className="rounded-full border border-border px-5 py-2 text-sm">
          Revenir aux valeurs par défaut
        </button>
      </div>
    </div>
  );
}
