import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getProfile, saveMyProfile } from "@/lib/profiles.functions";

type Profile = {
  id: string;
  name: string;
  bio: string;
  avatarUrl: string | null;
  isMe: boolean;
  publications: { id: string; category: string; kind: string; title: string; summary: string; body: string | null; createdAt: string }[];
};

export function ProfilePage({ userId, onSeeOffers }: { userId: string; onSeeOffers: () => void }) {
  const fetchProfile = useServerFn(getProfile);
  const save = useServerFn(saveMyProfile);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const p = (await fetchProfile({ data: { id: userId } })) as Profile | null;
    setProfile(p);
    if (p) {
      setName(p.name);
      setBio(p.bio);
    }
  };

  useEffect(() => {
    void load();
  }, [userId]);

  if (profile === undefined) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (profile === null) return <p className="text-sm text-muted-foreground">Ce profil n'existe pas.</p>;

  const onSave = async () => {
    const r = await save({ data: { displayName: name, bio } });
    setMessage(r.ok ? "Profil enregistré." : "Enregistrement impossible.");
    if (r.ok) {
      setEditing(false);
      await load();
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary/20 text-2xl font-bold">
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : profile.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{profile.name}</h1>
          <p className="text-sm text-muted-foreground">{profile.publications.length} publication(s)</p>
        </div>
        {profile.isMe && (
          <button onClick={() => setEditing(!editing)} className="rounded-full border border-white/15 px-3 py-1 text-sm">
            {editing ? "Annuler" : "Modifier"}
          </button>
        )}
      </header>

      {editing ? (
        <section className="space-y-3 rounded-2xl border border-white/10 p-4">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Nom affiché" className="w-full rounded-xl bg-background/60 p-2" />
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={3} placeholder="Présentation" className="w-full rounded-xl bg-background/60 p-2" />
          <button onClick={onSave} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Enregistrer</button>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </section>
      ) : (
        profile.bio && <p className="text-sm">{profile.bio}</p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Publications</h2>
        {profile.publications.length === 0 && <p className="text-sm text-muted-foreground">Aucune publication pour le moment.</p>}
        {profile.publications.map((r) => (
          <article key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{r.kind}</p>
            <h3 className="mt-1 font-semibold">{r.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{r.summary}</p>
            {r.body ? (
              <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-black/40 p-3 text-sm">{r.body}</pre>
            ) : (
              <button onClick={onSeeOffers} className="mt-3 rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground">Réservé aux abonnés</button>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
