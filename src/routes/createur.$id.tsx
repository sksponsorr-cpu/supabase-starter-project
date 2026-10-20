import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicCreator, type PublicCreator } from "@/lib/creator-public.functions";
import { BadgeCheck, ExternalLink, Eye } from "lucide-react";

export const Route = createFileRoute("/createur/$id")({
  head: () => ({ meta: [{ title: "Profil créateur — Sam flash 2.0" }] }),
  component: CreatorPage,
});

const fmt = (n: number) => n.toLocaleString("fr-FR");

function CreatorPage() {
  const { id } = Route.useParams();
  const load = useServerFn(getPublicCreator);
  const [creator, setCreator] = useState<PublicCreator | null | undefined>(undefined);

  useEffect(() => {
    void load({ data: { id } }).then(setCreator).catch(() => setCreator(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (creator === undefined) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Chargement…</div>;
  }
  if (creator === null) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Profil introuvable.</div>;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-amber-400 text-3xl font-bold text-white">
          {creator.name.charAt(0).toUpperCase()}
        </div>
        <h1 className="text-2xl font-bold text-foreground">@{creator.name.toLowerCase()}</h1>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
            creator.badge === "connecte" ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"
          }`}
        >
          <BadgeCheck className="h-3.5 w-3.5" />
          {creator.badge === "connecte" ? "Compte connecté" : "Profil manuel"}
        </span>
        <div className="mt-2 flex gap-8 text-center">
          <div>
            <p className="text-xl font-bold text-foreground">{fmt(creator.totals.videos)}</p>
            <p className="text-xs text-muted-foreground">vidéos validées</p>
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{fmt(creator.totals.eligible_views)}</p>
            <p className="text-xs text-muted-foreground">vues éligibles</p>
          </div>
        </div>
      </header>

      {creator.videos.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">Aucune vidéo validée pour l'instant.</p>
      ) : (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {creator.videos.map((v) => (
            <a
              key={v.id}
              href={v.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex aspect-[9/16] flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-b from-zinc-800 to-black p-3 text-white"
            >
              <span className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] capitalize">{v.platform}</span>
              <ExternalLink className="absolute right-2 top-2 h-4 w-4 opacity-70 group-hover:opacity-100" />
              <span className="flex items-center gap-1 text-xs font-semibold">
                <Eye className="h-3.5 w-3.5" /> {fmt(v.eligible_views)} vues éligibles
              </span>
              {v.published_at && (
                <span className="text-[10px] opacity-70">{new Date(v.published_at).toLocaleDateString("fr-FR")}</span>
              )}
            </a>
          ))}
        </section>
      )}
    </main>
  );
}
