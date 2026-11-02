import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getProfile, saveMyProfile } from "@/lib/profiles.functions";
import { CommunityFeed } from "@/components/samflash/CommunityFeed";

type Profile = {
  id: string;
  name: string;
  bio: string;
  avatarUrl: string | null;
  isMe: boolean;
  publications: { id: string }[];
  waiting: { id: string; kind: string; title: string; createdAt: string }[];
};

const initial = (name: string) => name.charAt(0).toUpperCase();

/** Profil façon Facebook, affiché dans la communauté (pas de page séparée). */
export function CommunityProfile({
  userId,
  onBack,
  onSeeOffers,
  onOpenProfile,
}: {
  userId: string;
  onBack: () => void;
  onSeeOffers: () => void;
  onOpenProfile: (id: string) => void;
}) {
  const fetchProfile = useServerFn(getProfile);
  const save = useServerFn(saveMyProfile);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [tab, setTab] = useState<"publications" | "apropos">("publications");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");

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

  if (profile === undefined) return <p className="py-8 text-center text-sm text-muted-foreground">Chargement…</p>;
  if (profile === null) return <p className="py-8 text-center text-sm text-muted-foreground">Ce profil n'existe pas.</p>;

  const onSave = async () => {
    const r = await save({ data: { displayName: name, bio } });
    if (r.ok) {
      setEditing(false);
      await load();
    }
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm font-semibold text-blue-400">← Retour à la communauté</button>

      {/* En-tête façon Facebook */}
      <section className="overflow-hidden rounded-xl border border-white/10 bg-[#18191a]">
        <div className="h-40 bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900" />
        <div className="px-4 pb-4">
          <div className="-mt-14 flex items-end gap-4">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-[#18191a] bg-blue-600 text-4xl font-bold">
              {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : initial(profile.name)}
            </div>
            <div className="min-w-0 flex-1 pb-2">
              <h1 className="truncate text-2xl font-bold">{profile.name}</h1>
              <p className="text-sm text-muted-foreground">{profile.publications.length} publication(s)</p>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            {profile.isMe ? (
              <button onClick={() => setEditing(!editing)} className="flex-1 rounded-lg bg-[#3a3b3c] py-2 text-sm font-semibold">
                {editing ? "Annuler" : "Modifier le profil"}
              </button>
            ) : (
              <button onClick={onSeeOffers} className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white">S'abonner pour tout voir</button>
            )}
          </div>

          {editing && (
            <div className="mt-4 space-y-2">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Nom affiché" className="w-full rounded-lg bg-[#3a3b3c] p-2 text-sm" />
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={3} placeholder="Présentation" className="w-full rounded-lg bg-[#3a3b3c] p-2 text-sm" />
              <button onClick={onSave} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Enregistrer</button>
            </div>
          )}
        </div>

        <nav className="grid grid-cols-2 border-t border-white/10 text-sm font-semibold">
          {([["publications", "Publications"], ["apropos", "À propos"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`py-3 ${tab === id ? "border-b-2 border-blue-500 text-blue-400" : "text-muted-foreground"}`}>
              {label}
            </button>
          ))}
        </nav>
      </section>

      {tab === "apropos" && (
        <section className="rounded-xl border border-white/10 bg-[#18191a] p-4 text-sm">
          <p>{profile.bio || "Aucune présentation pour le moment."}</p>
        </section>
      )}

      {tab === "publications" && (
        <>
          {profile.isMe && profile.waiting.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-amber-300">En attente de validation</h2>
              {profile.waiting.map((r) => (
                <article key={r.id} className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm">
                  <p className="font-semibold">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.kind} · visible après validation</p>
                </article>
              ))}
            </section>
          )}
          <CommunityFeed authorId={profile.id} onSeeOffers={onSeeOffers} onOpenProfile={onOpenProfile} />
        </>
      )}
    </div>
  );
}
