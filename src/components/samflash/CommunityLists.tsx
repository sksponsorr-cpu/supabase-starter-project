import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listResources } from "@/lib/resources.functions";
import { getDownloadUrl } from "@/lib/resources.members.functions";
import { listMembers } from "@/lib/community.members.functions";

const initial = (name: string) => name.charAt(0).toUpperCase();

/** Onglet Vidéos : une vignette par publication contenant une vidéo. */
export function VideosGrid({ onSeeOffers }: { onSeeOffers: () => void }) {
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

  if (items.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Aucune vidéo publiée pour le moment.</p>;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((v) => (
        <article key={v.id} className="overflow-hidden rounded-xl border border-white/10 bg-[#18191a]">
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
                className="mt-2 rounded-full bg-[#3a3b3c] px-3 py-1 text-sm"
              >
                Regarder
              </button>
            ) : (
              <button onClick={onSeeOffers} className="mt-2 rounded-full bg-blue-600 px-3 py-1 text-sm text-white">Réservé aux abonnés</button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

/** Onglet Membres : profils, cliquables vers la page profil. */
export function MembersGrid({ onOpenProfile }: { onOpenProfile: (id: string) => void }) {
  const list = useServerFn(listMembers);
  const [members, setMembers] = useState<{ id: string; name: string; bio: string; avatarUrl: string | null; publications: number }[]>([]);

  useEffect(() => {
    void list().then((m) => setMembers(m));
  }, []);

  if (members.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Aucun membre pour le moment.</p>;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {members.map((m) => (
        <button key={m.id} onClick={() => onOpenProfile(m.id)} className="flex items-center gap-4 rounded-xl border border-white/10 bg-[#18191a] p-4 text-left">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-lg font-bold">
            {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" /> : initial(m.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold">{m.name}</p>
            {m.bio && <p className="line-clamp-2 text-xs text-muted-foreground">{m.bio}</p>}
            <p className="mt-1 text-xs text-muted-foreground">{m.publications} publication(s)</p>
          </div>
        </button>
      ))}
    </div>
  );
}
