import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getLanding, setLanding } from "@/lib/landing.functions";
import { toast } from "@/lib/toast";

const box = "w-full rounded-2xl border border-border bg-secondary/50 px-4 py-3 text-sm outline-none focus:border-primary";

/** Section à part : vidéo de référence de la page et images de revenus générés avec la monétisation. */
export function AdminRevenuePanel() {
  const load = useServerFn(getLanding);
  const save = useServerFn(setLanding);
  const [refVideo, setRefVideo] = useState("");
  const [images, setImages] = useState("");
  const [current, setCurrent] = useState<Awaited<ReturnType<typeof load>> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load()
      .then((d) => {
        setCurrent(d);
        setRefVideo(d.revenue?.referenceVideo ?? "");
        setImages((d.revenue?.images ?? []).map((i) => `${i.url} | ${i.caption}`).join("\n"));
      })
      .catch(() => undefined);
  }, [load]);

  const submit = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const parsed = images
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [u, ...rest] = l.split("|");
          return { url: (u ?? "").trim(), caption: rest.join("|").trim() };
        });
      const res = await save({ data: { ...current, revenue: { referenceVideo: refVideo.trim(), images: parsed } } });
      if (!res.ok) toast.error(res.message);
      else toast.success("Section revenus enregistrée.");
    } catch {
      toast.error("Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border-2 border-primary/50 p-4">
      <h3 className="text-base font-semibold">Revenus et vidéo de référence</h3>
      <p className="text-xs text-muted-foreground">
        Section séparée de la vitrine. La vidéo de référence remplace la vidéo principale de la page de référence. Les images de revenus apparaissent sous les résultats.
      </p>

      <p className="text-sm font-medium">Vidéo de référence (lien https, .mp4)</p>
      <input className={box} placeholder="https://…/reference.mp4" value={refVideo} onChange={(e) => setRefVideo(e.target.value)} />

      <p className="text-sm font-medium">Images de revenus (une par ligne : lien | légende)</p>
      <textarea className={box} rows={5} placeholder={"https://…/revenu1.jpg | Revenus du mois de septembre"} value={images} onChange={(e) => setImages(e.target.value)} />

      <button
        type="button"
        disabled={busy || !current}
        onClick={() => void submit()}
        className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {busy ? "Enregistrement…" : "Enregistrer la section revenus"}
      </button>
    </section>
  );
}
