import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listFormations, type Formation } from "@/lib/formations.functions";

export const Route = createFileRoute("/formations")({
  component: FormationsPage,
});

const glass = "rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-2xl";
const SEEN_KEY = "sf_modules_vus";

/** Transforme un lien YouTube ou Vimeo en lien d'intégration ; sinon on garde le fichier vidéo. */
function playerFor(url: string): { type: "iframe" | "video"; src: string } {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  if (yt) return { type: "iframe", src: `https://www.youtube.com/embed/${yt[1]}` };
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return { type: "iframe", src: `https://player.vimeo.com/video/${vm[1]}` };
  return { type: "video", src: url };
}

/** Formation « Comment utiliser Sam Flash 2.0 » : modules numérotés, suivis sur cet appareil. */
function FormationsPage() {
  const fetchModules = useServerFn(listFormations);
  const [modules, setModules] = useState<Formation[] | null>(null);
  const [current, setCurrent] = useState(0);
  const [seen, setSeen] = useState<string[]>([]);

  useEffect(() => {
    try {
      setSeen(JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "[]"));
    } catch {
      setSeen([]);
    }
    fetchModules().then(setModules).catch(() => setModules([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = modules?.length ?? 0;
  const mod = modules?.[current];
  const player = useMemo(() => (mod ? playerFor(mod.videoUrl) : null), [mod]);

  const markSeen = (id: string) => {
    setSeen((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id];
      try {
        window.localStorage.setItem(SEEN_KEY, JSON.stringify(next));
      } catch {
        /* stockage indisponible : le suivi reste pour cette session */
      }
      return next;
    });
  };

  const goNext = () => {
    if (!modules || !mod) return;
    markSeen(mod.id);
    setCurrent((c) => Math.min(c + 1, modules.length - 1));
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-primary/25 blur-[120px]" />
      <div className="relative mx-auto max-w-xl space-y-5 px-5 py-10">
        <header className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Formation</p>
          <h1 className="text-3xl font-semibold tracking-tight">Comment utiliser Sam Flash 2.0</h1>
          <p className="text-sm text-muted-foreground">Des modules courts, à votre rythme.</p>
          {total > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="tabular-nums">{seen.length} sur {total} vus</span>
                <span>{total} modules</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-sky-300 transition-all duration-700 ease-out" style={{ width: `${(seen.length / total) * 100}%` }} />
              </div>
            </div>
          )}
        </header>

        {modules === null && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {modules?.length === 0 && <p className="text-sm text-muted-foreground">Les modules arrivent bientôt.</p>}

        {mod && player && (
          <article key={mod.id} className={`${glass} space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500`}>
            <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
              {player.type === "iframe" ? (
                <iframe src={player.src} title={mod.title} className="h-full w-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
              ) : (
                <video src={player.src} controls className="h-full w-full" />
              )}
            </div>
            <div>
              <p className="text-xs text-sky-300">Module {current + 1} sur {total}</p>
              <h2 className="mt-1 text-xl font-semibold">{mod.title}</h2>
              {mod.summary && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{mod.summary}</p>}
            </div>
            <div className="flex items-center justify-between gap-3">
              <button type="button" disabled={current === 0} onClick={() => setCurrent((c) => Math.max(c - 1, 0))} className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm transition-all duration-300 hover:bg-white/10 disabled:opacity-40">
                Précédent
              </button>
              <button type="button" disabled={current === total - 1} onClick={goNext} className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_10px_40px_-12px] shadow-primary/60 transition-all duration-500 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-40">
                Module suivant →
              </button>
            </div>
          </article>
        )}

        {modules && modules.length > 0 && (
          <section className={`${glass} space-y-2`}>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Tous les modules</p>
            {modules.map((m, i) => {
              const done = seen.includes(m.id);
              return (
                <button key={m.id} type="button" onClick={() => setCurrent(i)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm transition-colors duration-300 ${i === current ? "bg-white/10" : "hover:bg-white/5"}`}>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${done ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-muted-foreground"}`}>{done ? "✓" : i + 1}</span>
                  <span className="truncate">{m.title}</span>
                </button>
              );
            })}
          </section>
        )}

        <div className="text-center">
          <Link to="/vendeur" className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">Ouvrir l'espace vendeur</Link>
        </div>
      </div>
    </main>
  );
}
