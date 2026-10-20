import { useMemo, useRef, useState } from "react";
import { SELLER_FACES, type SellerFace } from "@/lib/seller-faces";

type Filter<T extends string> = { value: T | "tous"; label: string }[];
const GENRE: Filter<SellerFace["genre"]> = [{ value: "tous", label: "Tous" }, { value: "femme", label: "Femme" }, { value: "homme", label: "Homme" }];
const AGE: Filter<SellerFace["age"]> = [{ value: "tous", label: "Tous" }, { value: "jeune", label: "Jeune" }, { value: "adulte", label: "Adulte" }, { value: "senior", label: "Senior" }];
const LIEU: Filter<SellerFace["lieu"]> = [{ value: "tous", label: "Tous" }, { value: "interieur", label: "Intérieur" }, { value: "exterieur", label: "Extérieur" }];

function Chips<T extends string>({ options, value, onChange }: { options: Filter<T>; value: T | "tous"; onChange: (v: T | "tous") => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full border px-3 py-1.5 text-xs ${value === o.value ? "border-white bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Choix d'une personne : bibliothèque filtrable, ou photo importée par l'utilisateur. */
export function SellerFaceLibrary({ onSelect }: { onSelect: (dataUrl: string) => void }) {
  const [genre, setGenre] = useState<SellerFace["genre"] | "tous">("tous");
  const [age, setAge] = useState<SellerFace["age"] | "tous">("tous");
  const [lieu, setLieu] = useState<SellerFace["lieu"] | "tous">("tous");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const faces = useMemo(
    () => SELLER_FACES.filter((f) => (genre === "tous" || f.genre === genre) && (age === "tous" || f.age === age) && (lieu === "tous" || f.lieu === lieu)),
    [genre, age, lieu],
  );

  const importFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" && onSelect(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Genre</p>
        <Chips options={GENRE} value={genre} onChange={setGenre} />
        <p className="text-xs text-muted-foreground">Âge</p>
        <Chips options={AGE} value={age} onChange={setAge} />
        <p className="text-xs text-muted-foreground">Lieu</p>
        <Chips options={LIEU} value={lieu} onChange={setLieu} />
      </div>

      {faces.length === 0 ? (
        <p className="rounded-2xl border border-border p-4 text-sm text-muted-foreground">
          Aucune personne dans la bibliothèque pour l'instant. Importe ta propre photo ci-dessous.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {faces.map((f) => (
            <button key={f.id} type="button" onClick={() => onSelect(f.src)} className="overflow-hidden rounded-2xl border border-border">
              <img src={f.src} alt={f.label} className="aspect-[3/4] w-full object-cover" />
              <span className="block p-1.5 text-left text-xs text-muted-foreground">{f.label}</span>
            </button>
          ))}
        </div>
      )}

      <button type="button" onClick={() => fileRef.current?.click()} className="w-full rounded-2xl border border-dashed border-border py-3 text-sm text-muted-foreground">
        Importer ma photo
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
