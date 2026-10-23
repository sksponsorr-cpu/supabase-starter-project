import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminListFormations, adminAddFormation, adminDeleteFormation, type Formation } from "@/lib/formations.functions";

const field = "w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition-all duration-300 focus:border-primary/60";
const btn = "rounded-full px-4 py-2 text-xs font-semibold transition-all duration-500 ease-out hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-40";

/** Bureau admin : publier et retirer les formations (vidéo + description). */
export function AdminFormationsPanel() {
  const fetchList = useServerFn(adminListFormations);
  const add = useServerFn(adminAddFormation);
  const remove = useServerFn(adminDeleteFormation);

  const [items, setItems] = useState<Formation[]>([]);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = () => fetchList().then(setItems).catch(() => setItems([]));
  useEffect(() => { void reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const onAdd = async () => {
    setBusy(true);
    setNotice(null);
    const res = await add({ data: { title, summary, videoUrl } }).catch(() => ({ ok: false, message: "Erreur réseau." }));
    setNotice(res.message);
    if (res.ok) { setTitle(""); setSummary(""); setVideoUrl(""); }
    await reload();
    setBusy(false);
  };

  const onRemove = async (id: string) => {
    if (!window.confirm("Supprimer ce module ?")) return;
    await remove({ data: { id } }).catch(() => null);
    await reload();
  };

  return (
    <section className="space-y-5 rounded-3xl border border-border bg-card/50 p-5 backdrop-blur-xl">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">Formation « Comment utiliser Sam Flash 2.0 »</h3>
        <p className="text-xs text-muted-foreground">Ajoutez les modules dans l'ordre. Chaque module apparaît sur la page Formations.</p>
      </div>

      {notice && <p className="rounded-2xl bg-primary/10 px-4 py-3 text-sm">{notice}</p>}

      <div className="space-y-3 rounded-2xl border border-border p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Nouveau module</p>
        <input className={field} placeholder="Titre du module (ex. : Créer votre première image)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className={`${field} min-h-[80px]`} placeholder="Ce que l'abonné apprend dans ce module" value={summary} onChange={(e) => setSummary(e.target.value)} />
        <input className={field} placeholder="Lien de la vidéo (YouTube, Vimeo ou fichier .mp4)" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
        <button type="button" className={`${btn} bg-primary text-primary-foreground`} disabled={busy || title.trim().length < 3 || !videoUrl.startsWith("http")} onClick={() => void onAdd()}>
          {busy ? "Publication…" : "Publier le module"}
        </button>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Modules publiés ({items.length})</p>
        {items.length === 0 && <p className="text-sm text-muted-foreground">Aucun module pour le moment.</p>}
        {items.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border p-4">
            <div className="min-w-0">
              <p className="truncate font-semibold">{f.title}</p>
              <a href={f.videoUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-sky-300 underline-offset-4 hover:underline">{f.videoUrl}</a>
            </div>
            <button type="button" className={`${btn} bg-secondary`} onClick={() => void onRemove(f.id)}>Supprimer</button>
          </div>
        ))}
      </div>
    </section>
  );
}
