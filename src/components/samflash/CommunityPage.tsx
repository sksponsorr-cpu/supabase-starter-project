import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ResourcesFeed } from "@/components/samflash/ResourcesFeed";
import { MemberPublishForm } from "@/components/samflash/MemberPublishForm";
import { listResources } from "@/lib/resources.functions";
import { getDownloadUrl } from "@/lib/resources.members.functions";
import { listMembers } from "@/lib/community.members.functions";

type Tab = "fil" | "videos" | "membres";

/** Espace Communauté : fil de publications, vidéos, membres. */
export function CommunityPage({ onSeeOffers }: { onSeeOffers: () => void }) {
  const [tab, setTab] = useState<Tab>("fil");
  const [publishing, setPublishing] = useState(false);
  const [reload, setReload] = useState(0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Communauté</h1>
        <button onClick={() => setPublishing(!publishing)} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          {publishing ? "Fermer" : "Publier"}
        </button>
      </div>

      {publishing && <MemberPublishForm onDone={() => setReload((n) => n + 1)} />}

      <nav className="flex gap-2 border-b border-white/10 pb-2">
        {([
          ["fil", "Fil"],
          ["videos", "Vidéos"],
          ["membres", "Membres"],
        ] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === id ? "bg-white text-black" : "text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "fil" && <ResourcesFeed key={reload} onSeeOffers={onSeeOffers} />}
      {tab === "videos" && <VideosGrid onSeeOffers={onSeeOffers} />}
      {tab === "membres" && <MembersGrid />}
    </div>
  );
}

function VideosGrid({ onSeeOffers }: { onSeeOffers: () => void }) {
  const list = useServerFn(listResources);
  const download = useServerFn(getDownloadUrl);
  const [items, setItems] = useState<{ id: string; title: string; authorName: string; files: { id: string; name: string; mime: string }[] }[]>([]);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    void list({ data: { category: null } }).then((r) => {
      setUnlocked(r.unlocked);
      setItems(
        r.items
          .filter((i) => i.files.some((f) => f.mime.startsWith("video/")))
          .map((i) => ({ id: i.id, title: i.title, authorName: i.authorName, files: i.files.filter((f) => f.mime.startsWith("video/")) })),
      );
    });
  }, []);

  if (items.length === 0) return <p className="text-sm text-muted-foreground">Aucune vidéo publiée pour le moment.</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((v) => (
        <article key={v.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="flex aspect-video items-center justify-center bg-black text-4xl">▶</div>
          <div className="space-y-1 p-4">
            <h3 className="font-semibold">{v.title}</h3>
            <p className="text-xs text-muted-foreground">par {v.authorName}</p>
            {unlocked ? (
              <button
                onClick={async () => {
                  const r = await download({ data: { fileId: v.files[0].id } });
                  if (r.url) window.open(r.url, "_blank", "noopener");
                }}
                className="mt-2 rounded-full border border-white/15 px-3 py-1 text-sm"
              >
                Regarder
              </button>
            ) : (
              <button onClick={onSeeOffers} className="mt-2 rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground">
                Réservé aux abonnés
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function MembersGrid() {
  const list = useServerFn(listMembers);
  const [members, setMembers] = useState<{ id: string; name: string; bio: string; avatarUrl: string | null; publications: number }[]>([]);

  useEffect(() => {
    void list().then((m) => setMembers(m));
  }, []);

  if (members.length === 0) return <p className="text-sm text-muted-foreground">Aucun membre pour le moment.</p>;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {members.map((m) => (
        <a key={m.id} href={`/profil?id=${m.id}`} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/20 text-lg font-bold">
            {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" /> : m.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold">{m.name}</p>
            {m.bio && <p className="line-clamp-2 text-xs text-muted-foreground">{m.bio}</p>}
            <p className="mt-1 text-xs text-muted-foreground">{m.publications} publication(s)</p>
          </div>
        </a>
      ))}
    </div>
  );
}
