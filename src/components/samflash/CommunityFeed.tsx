import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listResources, toggleLike, listComments, addComment } from "@/lib/resources.functions";
import { getDownloadUrl } from "@/lib/resources.members.functions";

type File = { id: string; name: string; mime: string; size: number };
type Item = {
  id: string;
  category: string;
  kind: string;
  title: string;
  summary: string;
  authorId: string | null;
  authorName: string;
  body: string | null;
  createdAt: string;
  likes: number;
  comments: number;
  likedByMe: boolean;
  files: File[];
};

/** Temps relatif, en français : « il y a 12 min », « il y a 3 j ». */
function ago(iso: string): string {
  const min = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

const initial = (name: string) => name.charAt(0).toUpperCase();

/** Fil façon Facebook : carte par publication, barre d'actions, commentaires dépliables. */
export function CommunityFeed({ authorId, onSeeOffers, onOpenProfile }: { authorId?: string; onSeeOffers: () => void; onOpenProfile: (id: string) => void }) {
  const list = useServerFn(listResources);
  const [items, setItems] = useState<Item[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await list({ data: { category: null } });
      setItems(r.items as Item[]);
      setUnlocked(r.unlocked);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const shown = authorId ? items.filter((i) => i.authorId === authorId) : items;
  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Chargement du fil…</p>;
  if (shown.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Aucune publication pour le moment.</p>;

  return (
    <div className="space-y-4">
      {shown.map((it) => (
        <Post key={it.id} item={it} unlocked={unlocked} onSeeOffers={onSeeOffers} onOpenProfile={onOpenProfile} onChanged={load} />
      ))}
    </div>
  );
}

function Post({
  item,
  unlocked,
  onSeeOffers,
  onOpenProfile,
  onChanged,
}: {
  item: Item;
  unlocked: boolean;
  onSeeOffers: () => void;
  onOpenProfile: (id: string) => void;
  onChanged: () => void;
}) {
  const like = useServerFn(toggleLike);
  const [open, setOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [liked, setLiked] = useState(item.likedByMe);
  const [count, setCount] = useState(item.likes);

  const onLike = async () => {
    setLiked(!liked);
    setCount(count + (liked ? -1 : 1));
    try {
      await like({ data: { resourceId: item.id } });
    } catch {
      setLiked(liked);
      setCount(count);
    }
  };

  const canRead = unlocked && item.body !== null;

  return (
    <article className="overflow-hidden rounded-xl border border-white/10 bg-[#18191a]">
      {/* En-tête */}
      <header className="flex items-center gap-3 px-4 pt-4">
        <button onClick={() => item.authorId && onOpenProfile(item.authorId)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-white">
          {initial(item.authorName)}
        </button>
        <div className="min-w-0 flex-1">
          <button onClick={() => item.authorId && onOpenProfile(item.authorId)} className="block truncate text-sm font-semibold hover:underline">
            {item.authorName}
          </button>
          <p className="text-xs text-muted-foreground">
            {ago(item.createdAt)} · {item.kind} · 🌐
          </p>
        </div>
      </header>

      {/* Texte */}
      <div className="space-y-2 px-4 py-3">
        <h3 className="text-base font-semibold">{item.title}</h3>
        <p className="text-sm text-slate-300">{item.summary}</p>
        {open && canRead && <pre className="whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-sm">{item.body}</pre>}
        {!canRead && item.body !== null && !unlocked && (
          <button onClick={onSeeOffers} className="text-sm font-semibold text-blue-400">Voir le contenu complet (abonnés)</button>
        )}
        {canRead && !open && (
          <button onClick={() => setOpen(true)} className="text-sm font-semibold text-blue-400">Voir plus</button>
        )}
      </div>

      {/* Pièces jointes */}
      {item.files.length > 0 && (
        <div className="grid gap-px bg-white/5">
          {item.files.map((f) => (
            <Attachment key={f.id} file={f} unlocked={unlocked} onSeeOffers={onSeeOffers} />
          ))}
        </div>
      )}

      {/* Compteurs */}
      <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
        <span>{count > 0 ? `👍 ${count}` : ""}</span>
        <button onClick={() => setShowComments(!showComments)} className="hover:underline">
          {item.comments} commentaire(s)
        </button>
      </div>

      {/* Barre d'actions */}
      <div className="grid grid-cols-3 border-t border-white/10 text-sm font-semibold text-muted-foreground">
        <button onClick={onLike} className={`py-2.5 hover:bg-white/5 ${liked ? "text-blue-400" : ""}`}>👍 J'aime</button>
        <button onClick={() => setShowComments(!showComments)} className="py-2.5 hover:bg-white/5">💬 Commenter</button>
        <button
          onClick={() => navigator.share?.({ title: item.title, url: window.location.href }).catch(() => undefined)}
          className="py-2.5 hover:bg-white/5"
        >
          ↗ Partager
        </button>
      </div>

      {showComments && <Comments resourceId={item.id} onPosted={onChanged} />}
    </article>
  );
}

function Attachment({ file, unlocked, onSeeOffers }: { file: File; unlocked: boolean; onSeeOffers: () => void }) {
  const get = useServerFn(getDownloadUrl);
  const [busy, setBusy] = useState(false);
  const isImage = file.mime.startsWith("image/");
  const isVideo = file.mime.startsWith("video/");

  const open = async () => {
    if (!unlocked) return onSeeOffers();
    setBusy(true);
    try {
      const r = await get({ data: { fileId: file.id } });
      if (r.url) window.open(r.url, "_blank", "noopener");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button onClick={open} disabled={busy} className="flex items-center gap-3 bg-[#242526] px-4 py-6 text-left hover:bg-[#2c2d2e]">
      <span className="text-3xl">{isVideo ? "▶" : isImage ? "🖼" : "📄"}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{file.name}</span>
        <span className="text-xs text-muted-foreground">{unlocked ? (busy ? "Ouverture…" : "Ouvrir") : "Réservé aux abonnés"}</span>
      </span>
    </button>
  );
}

function Comments({ resourceId, onPosted }: { resourceId: string; onPosted: () => void }) {
  const fetchComments = useServerFn(listComments);
  const post = useServerFn(addComment);
  const [list, setList] = useState<{ id: string; author_name: string; body: string }[]>([]);
  const [text, setText] = useState("");

  const load = async () => setList((await fetchComments({ data: { resourceId } })) as typeof list);
  useEffect(() => {
    void load();
  }, []);

  const send = async () => {
    if (!text.trim()) return;
    await post({ data: { resourceId, body: text } });
    setText("");
    await load();
    onPosted();
  };

  return (
    <div className="space-y-3 border-t border-white/10 px-4 py-3">
      {list.map((c) => (
        <div key={c.id} className="flex gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">{initial(c.author_name)}</div>
          <div className="rounded-2xl bg-[#3a3b3c] px-3 py-2 text-sm">
            <p className="text-xs font-semibold">{c.author_name}</p>
            <p>{c.body}</p>
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écrire un commentaire…"
          className="flex-1 rounded-full bg-[#3a3b3c] px-4 py-2 text-sm outline-none"
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button onClick={send} className="text-sm font-semibold text-blue-400">Envoyer</button>
      </div>
    </div>
  );
}
