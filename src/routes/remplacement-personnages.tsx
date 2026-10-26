/**
 * Fiche d'un modèle : lecteur vidéo + trois emplacements nommés + coût en crédits + bouton « Recréer ».
 * Un clic sur « Recréer » lance directement la génération, sans changer de page.
 */
import { useState, type ChangeEvent } from "react";
import { X, Sparkles, User } from "lucide-react";

type Props = {
  videoUrl: string;
  title: string;
  /** Coût en crédits de la génération, affiché sur le bouton. */
  cost: number;
  busy: boolean;
  onClose: () => void;
  /** Appelé avec les photos remplies et, pour chacune, le nom du personnage à remplacer. */
  onRecreate: (photoDataUrls: string[], roles: string[]) => void;
};

const SLOT_NAMES = ["Personnage 1", "Personnage 2", "Personnage 3"];

export function TemplateRecreateModal({ videoUrl, title, cost, busy, onClose, onRecreate }: Props) {
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null]);
  const [names, setNames] = useState<string[]>(["", "", ""]);
  const [confirmed, setConfirmed] = useState(false);

  const setName = (index: number, value: string) =>
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)));

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
  const filledRoles = filledIndexes.map((i) => names[i].trim() || SLOT_NAMES[i]);
  const canRecreate = filled.length > 0 && confirmed && !busy;

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/70 backdrop-blur-sm" role="dialog" aria-label={title}>
      <div className="max-h-[94vh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-[#0d0d18] p-5 pb-8 text-white shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-lg font-semibold">{title}</p>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <video
          src={videoUrl}
          autoPlay
          muted
          loop
          playsInline
          controls
          controlsList="nodownload noremoteplayback nofullscreen"
          disablePictureInPicture
          disableRemotePlayback
          onContextMenu={(e) => e.preventDefault()}
          className="aspect-[9/16] w-full rounded-2xl bg-black object-cover"
        />

        <div className="mt-5 space-y-3">
          <p className="text-sm font-medium">Les personnages de la vidéo</p>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((src, i) => (
              <div key={i} className="relative">
                {src ? (
                  <>
                    <img src={src} alt={SLOT_NAMES[i]} className="aspect-[3/4] w-full rounded-2xl object-cover" />
                    <button type="button" onClick={() => setSlot(i, null)} aria-label={`Retirer ${SLOT_NAMES[i]}`} className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70">
                      <X className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <label className="flex aspect-[3/4] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-[#141426] text-white/50">
                    <User className="h-8 w-8" />
                    <span className="text-[11px]">{SLOT_NAMES[i]}</span>
                    <span className="text-[10px] text-white/35">Ajouter ma photo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={pickFor(i)} />
                  </label>
                )}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {photos.map((_, i) => (
              <input
                key={i}
                type="text"
                value={names[i]}
                onChange={(e) => setName(i, e.target.value)}
                maxLength={60}
                placeholder={`${SLOT_NAMES[i]} : qui remplace-t-il ? (ex. : joueur Barcelone)`}
                className="w-full rounded-xl border border-white/10 bg-[#141426] px-3 py-2 text-xs text-white outline-none focus:border-[#c8ff00]"
              />
            ))}
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
          <Sparkles className="h-5 w-5" /> {busy ? "Envoi en cours…" : `Recréer · ${cost} crédits`}
        </button>
      </div>
    </div>
  );
}
