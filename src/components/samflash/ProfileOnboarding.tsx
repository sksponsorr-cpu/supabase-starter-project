import { useEffect, useState } from "react";

type Choice = "creator" | "seller";

const STORAGE_KEY = "sam-flash-profile";

const OPTIONS: { id: Choice; label: string; hint: string }[] = [
  { id: "creator", label: "Créateur de contenu", hint: "Vidéos IA avec le modèle de votre choix" },
  { id: "seller", label: "Vendeur ou e-commerçant", hint: "Produits, influenceurs IA et voix off" },
];

/**
 * Choix de l'espace sur /app : un seul sélecteur compact, en haut de la page.
 * Le choix est mémorisé dans le navigateur. Il n'y a plus de second sélecteur ailleurs sur la page.
 */
export function ProfileOnboarding({ onChoose, allowed }: { onChoose: (c: Choice) => void; allowed: Choice[] }) {
  const [selected, setSelected] = useState<Choice | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Choice | null;
      if ((saved === "creator" || saved === "seller") && allowed.includes(saved)) {
        setSelected(saved);
        onChoose(saved);
        return;
      }
    } catch {
      /* navigateur sans stockage : on propose le choix sans mémoire */
    }
    if (allowed.length === 1) {
      setSelected(allowed[0]);
      onChoose(allowed[0]);
    }
  }, [onChoose, allowed]);

  const pick = (c: Choice) => {
    setSelected(c);
    onChoose(c);
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch {
      /* ignoré */
    }
  };

  const options = OPTIONS.filter((o) => allowed.includes(o.id));
  if (options.length === 0) return null;

  return (
    <div className="w-full max-w-md mx-auto px-4 mb-2">
      <div className="inline-flex w-full rounded-full border border-white/10 bg-white/[0.04] p-0.5">
        {options.map((o) => {
          const active = selected === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => pick(o.id)}
              aria-pressed={active}
              className={`flex-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors ${
                active ? "bg-white text-black" : "text-white/70 hover:text-white"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
