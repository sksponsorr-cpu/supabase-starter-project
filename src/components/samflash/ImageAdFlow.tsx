import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateMedia } from "@/lib/generation.functions";
import { toast } from "@/lib/toast";
import type { ImageAdPreset } from "@/lib/image-ad-presets";

type Props = { preset: ImageAdPreset; onClose: () => void };

const FORMATS = [
  { value: "1:1", label: "Carré 1:1" },
  { value: "4:5", label: "Portrait 4:5" },
  { value: "9:16", label: "Story 9:16" },
  { value: "16:9", label: "Paysage 16:9" },
] as const;
const LANGUES = ["Français", "English"] as const;
const SEXES = ["Une femme", "Un homme"] as const;
const AGES = ["20 à 30 ans", "30 à 45 ans", "50 à 60 ans"] as const;
const GESTES = ["Le tient en main", "L'utilise", "Le porte"] as const;
const LIEUX = ["Salon", "Cuisine", "Salle de bain"] as const;
const COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const MAX_PHOTOS = 4;
const MAX_DESC = 1500;

type Format = (typeof FORMATS)[number]["value"];

function Choice<T extends string | number>({ options, value, onChange, labels }: { options: readonly T[]; value: T; onChange: (v: T) => void; labels?: readonly string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o, i) => (
        <button
          key={String(o)}
          type="button"
          aria-pressed={value === o}
          onClick={() => onChange(o)}
          className={`rounded-full border px-4 py-2 text-sm ${value === o ? "border-violet-500 text-violet-300" : "border-white/10 text-white/60"}`}
        >
          {labels ? labels[i] : String(o)}
        </button>
      ))}
    </div>
  );
}

/** Création image : photo(s) du produit, réglages (selon le style), nombre d'images. Un crédit par image. */
export function ImageAdFlow({ preset, onClose }: Props) {
  const run = useServerFn(generateMedia);
  const [photos, setPhotos] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [langue, setLangue] = useState<(typeof LANGUES)[number]>("Français");
  const [format, setFormat] = useState<Format>("9:16");
  const [count, setCount] = useState<number>(4);
  const [sexe, setSexe] = useState<(typeof SEXES)[number]>("Une femme");
  const [age, setAge] = useState<(typeof AGES)[number]>("20 à 30 ans");
  const [geste, setGeste] = useState<(typeof GESTES)[number]>("Le tient en main");
  const [lieu, setLieu] = useState<(typeof LIEUX)[number]>("Salon");
  const [busy, setBusy] = useState(false);

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS - photos.length);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") setPhotos((p) => [...p, reader.result as string].slice(0, MAX_PHOTOS));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const buildPrompt = () => {
    const nom = name.trim() ? `Produit : ${name.trim()}. ` : "";
    if (preset.withPerson) {
      return `${nom}${sexe} de ${age}, ${geste.toLowerCase()} ce produit, dans un ${lieu.toLowerCase()}. Photo réaliste et naturelle, sans texte ni logo.`;
    }
    return `${nom}Publicité image prête à publier pour ce produit. Garde le produit strictement identique à la photo de référence (forme, couleurs, matière, logo, inscriptions) : ne le modifie pas. ${description.trim()} Textes en ${langue.toLowerCase()} : accroche, bénéfices, bouton d'appel à l'action et légende.`;
  };

  const launch = async () => {
    setBusy(true);
    let created = 0;
    try {
      for (let i = 0; i < count; i++) {
        const res = await run({
          data: {
            prompt: buildPrompt(),
            mediaType: "image",
            resolution: "",
            duration: "",
            aspectRatio: format,
            imageUrl: photos[0] ?? null,
            imageUrls: photos,
            creatorMode: "image",
            model: null,
            project_id: null,
            wallet: "seller",
          } as never,
        });
        if (!res.ok) {
          toast.error(res.message ?? "La création n'a pas pu démarrer. Tes crédits ne sont pas décomptés.");
          break;
        }
        created++;
      }
      if (created > 0) {
        toast.success(`${created} image(s) lancée(s). Tu les retrouveras dans Créations.`);
        onClose();
      }
    } catch {
      toast.error("La création n'a pas pu démarrer. Tes crédits ne sont pas décomptés.");
    } finally {
      setBusy(false);
    }
  };

  const canLaunch = photos.length > 0 && !busy;

  return (
    <div className="fixed inset-0 z-[100] flex items-end bg-black/60" role="dialog" aria-label={preset.title}>
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#0d0d18] p-5 pb-28 text-white">
        <div className="mb-5 flex items-center justify-between">
          <p className="text-lg font-semibold">{preset.title}</p>
          <button type="button" onClick={onClose} className="text-sm text-white/60">Changer de type</button>
        </div>

        {/* Photo(s) du produit */}
        <section className="space-y-3">
          <p className="font-semibold">Ajouter une image</p>
          <p className="text-xs text-white/50">Une photo nette, le produit en entier. Tu peux ajouter jusqu'à trois autres angles.</p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-[#141426] p-6 text-center">
            <span className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold">Ajouter une photo</span>
            <span className="text-xs text-violet-300">Choisir dans mes fichiers</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={onFiles} disabled={photos.length >= MAX_PHOTOS} />
          </label>
          {photos.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {photos.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt={`Produit ${i + 1}`} className="aspect-square w-full rounded-xl object-cover" />
                  <button
                    type="button"
                    aria-label="Retirer la photo"
                    onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                    className="absolute right-1 top-1 rounded-full bg-black/70 px-2 text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div>
            <p className="mb-1 text-sm text-white/70">Nom du produit</p>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#141426] px-3 py-2.5 text-sm outline-none" />
            <p className="mt-1 text-xs text-white/40">Facultatif. Il nomme la création dans ta liste.</p>
          </div>
        </section>

        {preset.withPerson ? (
          <section className="mt-6 space-y-4">
            <p className="font-semibold">Les réglages</p>
            <div>
              <p className="mb-2 text-sm text-white/70">Qui tient le produit</p>
              <Choice options={SEXES} value={sexe} onChange={setSexe} />
            </div>
            <div>
              <p className="mb-2 text-sm text-white/70">Âge</p>
              <Choice options={AGES} value={age} onChange={setAge} />
            </div>
            <div>
              <p className="mb-2 text-sm text-white/70">Le geste</p>
              <Choice options={GESTES} value={geste} onChange={setGeste} />
            </div>
            <div>
              <p className="mb-2 text-sm text-white/70">Lieu</p>
              <Choice options={LIEUX} value={lieu} onChange={setLieu} />
            </div>
          </section>
        ) : (
          <section className="mt-6 space-y-4">
            <div>
              <p className="mb-2 font-semibold">Description</p>
              <textarea
                value={description}
                maxLength={MAX_DESC}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Promo -20 % ce weekend, livraison Abidjan, ton premium."
                rows={4}
                className="w-full rounded-2xl border border-white/10 bg-[#141426] p-3 text-sm outline-none"
              />
              <p className="mt-1 text-right text-xs text-white/40">{description.length} / {MAX_DESC}</p>
            </div>
            <div>
              <p className="mb-2 font-semibold">Langue des textes</p>
              <Choice options={LANGUES} value={langue} onChange={setLangue} />
            </div>
          </section>
        )}

        <section className="mt-6 space-y-4">
          <div>
            <p className="mb-2 font-semibold">Format</p>
            <Choice options={FORMATS.map((f) => f.value)} value={format} onChange={setFormat} labels={FORMATS.map((f) => f.label)} />
          </div>
          <div>
            <p className="mb-2 font-semibold">Nombre d'images</p>
            <Choice options={COUNTS} value={count} onChange={setCount} />
          </div>
        </section>
      </div>

      {/* Barre de lancement */}
      <div className="fixed bottom-0 left-0 right-0 z-[110] flex items-center gap-3 border-t border-white/10 bg-[#0d0d18] p-4">
        <p className="whitespace-nowrap text-sm text-white/70">{count} images, {count} crédits</p>
        <button
          type="button"
          disabled={!canLaunch}
          onClick={() => void launch()}
          className="flex-1 rounded-full bg-violet-600 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Création…" : photos.length > 0 ? "Créer les photos" : "Ajoute un produit pour générer"}
        </button>
      </div>
    </div>
  );
}
