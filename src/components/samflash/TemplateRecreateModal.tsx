/**
 * Fiche d'un modèle : lecteur vidéo + trois emplacements « Personnage » + bouton « Recréer ».
 * Chaque emplacement est vide au départ : l'utilisateur y ajoute SA photo (ou celle d'une personne
 * qui lui a donné son accord, ou celle de son produit), puis coche la case de confirmation des droits.
 */
import { useState, type ChangeEvent } from "react";
import { X, Sparkles, User } from "lucide-react";

type Props = {
  videoUrl: string;
  title: string;
  onClose: () => void;
  /** Appelé avec les photos remplies et, pour chacune, la description du personnage à remplacer. */
  onRecreate: (photoDataUrls: string[], roles: string[]) => void;
};

const SLOTS = 3;

export function TemplateRecreateModal({ videoUrl, title, onClose, onRecreate }: Props) {
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null]);
  const [confirmed, setConfirmed] = useState(false);
  const [roles, setRoles] = useState<string[]>(["", "", ""]);

  const setRole = (index: number, value: string) =>
    setRoles((prev) => prev.map((r, i) => (i === index ? value : r)));

  const setSlot = (index: number, dataUrl: string | null) =>
    setPhotos((prev) => prev.map((p, i) => (i === index ? dataUrl : p)));

  const pickFor = (index: number) => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setSlot(index, reader.result);
    };
    reader.readAsDataURL(file);
  };

  const filledIndexes = photos.map((p, i) => (p !== null ? i : -1)).filter((i) => i >= 0);
  const filled = filledIndexes.map((i) => photos[i] as string);
  const filledRoles = filledIndexes.map((i) => roles[i].trim() || `Personnage ${i + 1}`);
  const canRecreate = filled.length > 0 && confirmed;

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/70 backdrop-blur-sm" role="dialog" aria-label={title}>
      <style>{`
        @keyframes tmSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes tmFade { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
      <div className="max-h-[94vh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-[#0d0d18] p-5 pb-8 text-white shadow-2xl" style={{ animation: "tmSlideUp .4s cubic-bezier(.2,.8,.2,1) both" }}>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-lg font-semibold">{title}</p>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <video src={videoUrl} controls playsInline loop className="aspect-[9/16] w-full rounded-2xl bg-black object-cover" />

        <div className="mt-5 space-y-3" style={{ animation: "tmFade .45s ease-out .1s both" }}>
          <p className="text-sm font-medium">Les personnages de la vidéo</p>
          <p className="text-xs text-white/50">
            Ajoute ta photo dans chaque emplacement à remplacer. Tu peux en remplir un, deux ou trois.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((src, i) => (
              <div key={i} className="relative">
                {src ? (
                  <>
                    <img src={src} alt={`Personnage ${i + 1}`} className="aspect-[3/4] w-full rounded-2xl object-cover" />
                    <button type="button" onClick={() => setSlot(i, null)} aria-label={`Retirer le personnage ${i + 1}`} className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70">
                      <X className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <label className="flex aspect-[3/4] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-[#141426] text-white/50 transition-transform active:scale-[0.98]">
                    <User className="h-8 w-8" />
                    <span className="text-[11px]">Personnage {i + 1}</span>
                    <span className="text-[10px] text-white/35">Ajouter ma photo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={pickFor(i)} />
                  </label>
                )}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {photos.map((src, i) =>
              src ? (
                <input
                  key={i}
                  type="text"
                  value={roles[i]}
                  onChange={(e) => setRole(i, e.target.value)}
                  maxLength={60}
                  placeholder={`Personnage ${i + 1} : qui est-ce dans la vidéo ? (ex. : le personnage debout à gauche)`}
                  className="w-full rounded-xl border border-white/10 bg-[#141426] px-3 py-2 text-xs text-white outline-none focus:border-[#c8ff00]"
                />
              ) : null,
            )}
          </div>
        </div>

        <label className="mt-5 flex items-start gap-3 rounded-2xl bg-[#141426] p-4 text-xs text-white/70">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#c8ff00]" />
          <span>Je confirme que les personnes sur ces photos sont moi, une personne qui m'a donné son accord, ou un produit qui m'appartient.</span>
        </label>

        <button
          type="button"
          disabled={!canRecreate}
          onClick={() => onRecreate(filled, filledRoles)}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#c8ff00] py-4 text-base font-bold text-black transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          <Sparkles className="h-5 w-5" /> Recréer
        </button>
      </div>
    </div>
  );
}
