import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "sam-flash-creator-profile";

type Video = { title: string; url: string };
type Profile = {
  name: string;
  photo: string | null;
  tiktok: string;
  followers: string;
  likes: string;
  bio: string;
  videos: Video[];
};

const EMPTY: Profile = { name: "", photo: null, tiktok: "", followers: "", likes: "", bio: "", videos: [] };

/** Profil créateur : photo, nom, compte TikTok, description et vidéos liées. Enregistré dans ce navigateur. */
export function CreatorProfile() {
  const { profile: account } = useAuth();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Profile>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setData({ ...EMPTY, ...(JSON.parse(raw) as Profile) });
    } catch {
      /* ignoré */
    }
  }, []);

  useEffect(() => {
    if (!data.name && account?.full_name) setData((d) => ({ ...d, name: account.full_name ?? "" }));
  }, [account?.full_name]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch: Partial<Profile>) => {
    setSaved(false);
    setData((d) => ({ ...d, ...patch }));
  };

  const onPhoto = (file: File | undefined) => {
    setPhotoError(null);
    if (!file) return;
    if (file.size > 400_000) {
      setPhotoError("Choisissez une photo de moins de 400 Ko.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update({ photo: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const save = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setSaved(true);
    } catch {
      setPhotoError("Enregistrement impossible sur ce navigateur.");
    }
  };

  const addVideo = () => {
    const url = newUrl.trim();
    if (!/^https?:\/\//.test(url)) return;
    update({ videos: [...data.videos, { title: newTitle.trim() || "Vidéo", url }] });
    setNewTitle("");
    setNewUrl("");
  };

  const field = "w-full rounded-xl border-0 bg-white/[0.06] px-3 py-2.5 text-[15px] text-white placeholder:text-white/35 outline-none";

  return (
    <div className="mx-auto mt-4 w-full max-w-xl px-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left"
      >
        <span className="text-[14px] font-semibold text-white">Mon profil créateur</span>
        <span className="text-[12px] text-white/50">{open ? "Fermer" : "Ouvrir"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-4">
            <label className="relative block h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-full bg-white/10">
              {data.photo ? (
                <img src={data.photo} alt="Photo de profil" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[11px] text-white/50">Photo</span>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
            </label>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-white">{data.name || "Votre nom"}</p>
              <p className="text-[12px] text-white/50">{data.tiktok ? `@${data.tiktok.replace(/^@/, "")}` : "Compte TikTok à ajouter"}</p>
            </div>
          </div>
          {photoError && <p className="text-[12px] text-red-400">{photoError}</p>}

          <label className="block space-y-1">
            <span className="text-[12px] text-white/60">Votre nom</span>
            <input className={field} value={data.name} onChange={(e) => update({ name: e.target.value })} />
          </label>
          <label className="block space-y-1">
            <span className="text-[12px] text-white/60">Compte TikTok</span>
            <input className={field} placeholder="@votrecompte" value={data.tiktok} onChange={(e) => update({ tiktok: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-[12px] text-white/60">Abonnés</span>
              <input className={field} inputMode="numeric" value={data.followers} onChange={(e) => update({ followers: e.target.value })} />
            </label>
            <label className="block space-y-1">
              <span className="text-[12px] text-white/60">J'aime</span>
              <input className={field} inputMode="numeric" value={data.likes} onChange={(e) => update({ likes: e.target.value })} />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-[12px] text-white/60">Description</span>
            <textarea rows={3} className={field} value={data.bio} onChange={(e) => update({ bio: e.target.value })} />
          </label>

          <div className="space-y-2">
            <p className="text-[12px] text-white/60">Vidéos liées à mon profil</p>
            {data.videos.map((v, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.05] px-3 py-2">
                <a href={v.url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-[13px] text-white/85 underline-offset-4 hover:underline">
                  {v.title}
                </a>
                <button type="button" className="text-[12px] text-white/50" onClick={() => update({ videos: data.videos.filter((_, j) => j !== i) })}>
                  Retirer
                </button>
              </div>
            ))}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr_auto]">
              <input className={field} placeholder="Titre" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              <input className={field} placeholder="https://www.tiktok.com/..." value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
              <button type="button" onClick={addVideo} className="rounded-xl bg-white/10 px-4 py-2.5 text-[13px] font-medium text-white">
                Ajouter
              </button>
            </div>
          </div>

          <button type="button" onClick={save} className="w-full rounded-2xl bg-[#d4ff00] py-3 text-[15px] font-semibold text-black">
            Enregistrer mon profil
          </button>
          {saved && <p className="text-center text-[12px] text-[#d4ff00]">Profil enregistré.</p>}
        </div>
      )}
    </div>
  );
}
