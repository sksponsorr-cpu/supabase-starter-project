/**
 * Fenêtre « Recréer » inspirée de Higgsfield :
 * une vidéo, des cartes-personnages à remplir (horizontales), un bouton fixe en bas avec le coût.
 * Aucun menu d'options : tout se fait ici, et un clic lance la génération.
 */
import { useState, type ChangeEvent } from "react";
import { X, Sparkles, Plus } from "lucide-react";

type Props = {
  videoUrl: string;
  title: string;
  /** Coût en crédits, affiché sur le bouton. */
  cost: number;
  busy: boolean;
  /** Message d'erreur affiché dans la fenêtre (null si aucun). */
  error: string | null;
  onClose: () => void;
  /** Appelé avec les photos remplies et le nom du personnage pour chacune. */
  onRecreate: (photoDataUrls: string[], roles: string[]) => void;
};

const SLOTS = [
  { label: "Personnage 1", placeholder: "ex. joueur Barcelone" },
  { label: "Personnage 2", placeholder: "ex. joueur Real" },
  { label: "Personnage 3", placeholder: "ex. joueur Real" },
];

export function TemplateRecreateModal({ videoUrl, title, cost, busy, error, onClose, onRecreate }: Props) {
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null]);
  const [names, setNames] = useState<string[]>(["", "", ""]);
  const [confirmed, setConfirmed] = useState(false);

  const pickFor = (index: number) => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPhotos((prev) => prev.map((p, i) => (i === index ? (reader.result as string) : p)));
      }
    };
    reader.readAsDataURL(file);
  };

  const removeAt = (index: number) => setPhotos((prev) => prev.map((p, i) => (i === index ? null : p)));
  const setName = (index: number, value: string) =>
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)));

  const filledIndexes = photos.map((p, i) => (p !== null ? i : -1)).filter((i) => i >= 0);
  const canRecreate = filledIndexes.length > 0 && confirmed && !busy;

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/70" role="dialog" aria-label={title}>
      <div className="flex max-h-[94vh] w-full max-w-md flex-col rounded-t-[28px] bg-[#101018] text-white shadow-2xl">
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <p className="text-base font-semibold">{title}</p>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4">
          <video
            src={videoUrl}
            autoPlay
            muted
            loop
            playsInline
            controls
            className="aspect-[9/16] max-h-[38vh] w-full rounded-2xl bg-black object-cover"
          />

          <p className="mt-5 text-sm font-medium">Qui remplace qui ?</p>
          <p className="text-xs text-white/50">Ajoutez votre photo à chaque personnage. Vous pouvez en remplir une, deux ou trois.</p>

          <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
            {SLOTS.map((slot, i) => (
              <div key={i} className="w-[42%] shrink-0">
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-[#1a1a28]">
                  {photos[i] ? (
                    <>
                      <img src={photos[i] as string} alt={slot.label} className="h-full w-full object-cover" />
                      <button type="button" onClick={() => removeAt(i)} aria-label={`Retirer ${slot.label}`} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 text-white/60">
                      <span className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-2 text-xs font-medium">
                        <Plus className="h-3.5 w-3.5" /> Votre photo
                      </span>
                      <input type="file" accept="image/*" className="hidden" onChange={pickFor(i)} />
                    </label>
                  )}
                </div>
                <p className="mt-2 text-xs font-medium">{slot.label}</p>
                <input
                  type="text"
                  value={names[i]}
                  onChange={(e) => setName(i, e.target.value)}
                  maxLength={60}
                  placeholder={slot.placeholder}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#1a1a28] px-2 py-1.5 text-[11px] text-white outline-none focus:border-[#c8ff00]"
                />
              </div>
            ))}
          </div>

          <label className="mt-4 flex items-start gap-3 rounded-2xl bg-[#1a1a28] p-3 text-xs text-white/70">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#c8ff00]" />
            <span>Je confirme que ces photos sont les miennes, ou celles d'une personne qui m'a donné son accord.</span>
          </label>

          {error && (
            <div role="alert" className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="border-t border-white/10 bg-[#101018] p-4 pb-6">
          <button
            type="button"
            disabled={!canRecreate}
            onClick={() =>
              onRecreate(
                filledIndexes.map((i) => photos[i] as string),
                filledIndexes.map((i) => names[i].trim() || SLOTS[i].label),
              )
            }
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#c8ff00] py-4 text-base font-bold text-black transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            <Sparkles className="h-5 w-5" /> {busy ? "Envoi en cours…" : `Recréer · ${cost} crédits`}
          </button>
        </div>
      </div>
    </div>
  );
      }
