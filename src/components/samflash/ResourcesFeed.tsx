import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listResources, toggleLike, listComments, addComment } from "@/lib/resources.functions";

type Item = {
  id: string;
  category: string;
  kind: string;
  title: string;
  summary: string;
  authorId: string | null;
  authorName: string;
  body: string | null;
  preview: boolean;
  createdAt: string;
  likes: number;
  comments: number;
  likedByMe: boolean;
};

const CATEGORIES: { id: string; label: string }[] = [
  { id: "", label: "Tout" },
  { id: "formations", label: "Formations" },
  { id: "prompts", label: "Prompts" },
  { id: "niches", label: "Niches virales" },
  { id: "actu", label: "Actualités" },
  { id: "skills", label: "Compétences" },
];

export function ResourcesFeed({ onSeeOffers }: { onSeeOffers: () => void }) {
  const list = useServerFn(listResources);
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async (cat: string) => {
    setLoading(true);
    try {
      const r = await list({ data: { category: cat || null } });
      setItems(r.items as Item[]);
      setUnlocked(r.unlocked);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(category);
  }, [category]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id || "all"}
            onClick={() => setCategory(c.id)}
            className={`rounded-full px-3 py-1.5 text-sm ${category === c.id ? "bg-primary text-primary-foreground" : "border border-white/15"}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {!unlocked && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="font-semibold">Débloquez toutes les ressources</p>
          <p className="mt-1 text-sm text-muted-foreground">Formations, prompts détaillés, niches virales et actualités : réservés aux abonnés.</p>
          <button onClick={onSeeOffers} className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Voir les offres
          </button>
        </div>
      )}

      {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {!loading && items.length === 0 && <p className="text-sm text-muted-foreground">Aucune ressource pour le moment.</p>}

      {items.map((item) => (
        <Post key={item.id} item={item} unlocked={unlocked} onSeeOffers={onSeeOffers} onChanged={() => void load(category)} />
      ))}
    </div>
  );
}

function Post({ item, unlocked, onSeeOffers, onChanged }: { item: Item; unlocked: boolean; onSeeOffers: () => void; onChanged: () => void }) {
  const like = useServerFn(toggleLike);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const canRead = unlocked && item.body !== null;

  const onLike = async () => {
    setBusy(true);
    try {
      await like({ data: { resourceId: item.id } });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {item.kind} · par{" "}
        {item.authorId ? (
          <a href={`/profil?id=${item.authorId}`} className="font-semibold text-foreground underline">{item.authorName}</a>
        ) : (
          <span className="font-semibold text-foreground">{item.authorName}</span>
        )}
      </p>
      <h3 className="mt-1 font-semibold">{item.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>

      {open && canRead && <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-black/40 p-3 text-sm">{item.body}</pre>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canRead || item.preview ? (
          <button onClick={() => setOpen(!open)} className="rounded-full border border-white/15 px-3 py-1 text-sm">
            {open ? "Fermer" : canRead ? "Lire" : "Aperçu"}
          </button>
        ) : (
          <button onClick={onSeeOffers} className="rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground">
            Réservé aux abonnés
          </button>
        )}
        <button onClick={onLike} disabled={busy} className="rounded-full border border-white/15 px-3 py-1 text-sm">
          {item.likedByMe ? "♥" : "♡"} {item.likes}
        </button>
        <span className="text-sm text-muted-foreground">{item.comments} commentaire(s)</span>
      </div>

      <Comments resourceId={item.id} onPosted={onChanged} />
    </article>
  );
}

function Comments({ resourceId, onPosted }: { resourceId: string; onPosted: () => void }) {
  const fetchComments = useServerFn(listComments);
  const post = useServerFn(addComment);
  const [comments, setComments] = useState<{ id: string; author_name: string; body: string; created_at: string }[]>([]);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);

  const load = async () => setComments((await fetchComments({ data: { resourceId } })) as typeof comments);

  useEffect(() => {
    if (open) void load();
  }, [open]);

  const send = async () => {
    if (!text.trim()) return;
    await post({ data: { resourceId, body: text } });
    setText("");
    await load();
    onPosted();
  };

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <button onClick={() => setOpen(!open)} className="text-sm text-muted-foreground">
        {open ? "Masquer les commentaires" : "Voir les commentaires"}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="rounded-xl bg-black/30 p-3 text-sm">
              <p className="font-semibold">{c.author_name}</p>
              <p className="mt-1">{c.body}</p>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              placeholder="Écrire un commentaire…"
              className="flex-1 rounded-full border border-white/15 bg-background/60 px-4 py-2 text-sm"
            />
            <button onClick={send} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Envoyer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
