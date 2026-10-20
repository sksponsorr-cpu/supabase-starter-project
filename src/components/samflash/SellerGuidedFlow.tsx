import { useState } from "react";
import { SellerFaceLibrary } from "@/components/samflash/SellerFaceLibrary";

export type GuidedFeature = {
  title: string;
  starter: string;
  mediaType: "image" | "video";
  modelId?: string;
  videoMode?: string;
  needsPerson: boolean;
  needsProduct: boolean;
};

type Props = { feature: GuidedFeature; onClose: () => void };

/** Parcours en étapes : Personne → Produit → Texte → Lancer. Les images vont dans la barre de saisie. */
export function SellerGuidedFlow({ feature, onClose }: Props) {
  const steps = [
    ...(feature.needsPerson ? ["Personne"] : []),
    ...(feature.needsProduct ? ["Produit"] : []),
    "Texte",
    "Lancer",
  ];
  const [step, setStep] = useState(0);
  const [person, setPerson] = useState<string | null>(null);
  const [product, setProduct] = useState<string | null>(null);
  const [text, setText] = useState(feature.starter);
  const current = steps[step];

  const readFile = (cb: (s: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" && cb(reader.result);
    reader.readAsDataURL(file);
  };

  // Raison affichée quand « Continuer » est désactivé.
  const blocker =
    current === "Personne" && !person
      ? "Choisis d'abord une personne."
      : current === "Produit" && !product
        ? "Ajoute d'abord une photo du produit."
        : current === "Texte" && text.trim().length < 10
          ? "Décris ce que tu veux dans le texte."
          : null;

  const launch = () => {
    const images = [person, product].filter((x): x is string => !!x);
    window.dispatchEvent(
      new CustomEvent("samflash:seller-preset", {
        detail: { text, mediaType: feature.mediaType, modelId: feature.modelId, videoMode: feature.videoMode, images },
      }),
    );
    onClose();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end bg-black/70" role="dialog" aria-label={feature.title}>
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-[#0b0b0f] p-5 text-white">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-semibold">{feature.title}</p>
          <button type="button" onClick={onClose} className="text-sm text-white/60">Fermer</button>
        </div>
        <p className="mb-4 text-xs text-white/50">
          Étape {step + 1} sur {steps.length} : {current}
        </p>

        {current === "Personne" && <SellerFaceLibrary onSelect={(s) => setPerson(s)} />}
        {current === "Produit" && (
          <div className="space-y-3">
            {product && <img src={product} alt="Produit" className="max-h-48 rounded-2xl object-contain" />}
            <input type="file" accept="image/*" onChange={readFile(setProduct)} className="text-sm" />
          </div>
        )}
        {current === "Texte" && (
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="w-full rounded-2xl bg-white/5 p-3 text-sm outline-none" />
        )}
        {current === "Lancer" && (
          <div className="space-y-3 text-sm text-white/80">
            <p>Ta création part avec : {person ? "une personne" : "aucune personne"}, {product ? "ton produit" : "aucun produit"}.</p>
            <p className="text-white/50">Le prix exact s'affiche dans la barre de saisie avant l'envoi.</p>
          </div>
        )}

        {blocker && <p className="mt-4 text-sm text-amber-300">{blocker}</p>}
        <div className="mt-5 flex gap-3">
          <button type="button" disabled={step === 0} onClick={() => setStep((s) => s - 1)} className="flex-1 rounded-full border border-white/20 py-3 text-sm disabled:opacity-40">
            Retour
          </button>
          {step < steps.length - 1 ? (
            <button type="button" disabled={!!blocker} onClick={() => setStep((s) => s + 1)} className="flex-1 rounded-full bg-white py-3 text-sm font-semibold text-black disabled:opacity-40">
              Continuer
            </button>
          ) : (
            <button type="button" onClick={launch} className="flex-1 rounded-full bg-white py-3 text-sm font-semibold text-black">
              Mettre dans la barre
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
