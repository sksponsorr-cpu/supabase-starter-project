import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SellerFaceLibrary } from "@/components/samflash/SellerFaceLibrary";
import { generateMedia } from "@/lib/generation.functions";
import { generateAdCopy } from "@/lib/ad-copy.functions";
import { toast } from "@/lib/toast";

export type GuidedFeature = {
  title: string;
  starter: string;
  mediaType: "image" | "video";
  modelId?: string;
  /** text_to_video | image_to_video (mode vidéo du modèle) */
  videoMode?: "text_to_video" | "image_to_video";
  needsPerson: boolean;
  needsProduct: boolean;
};

type Props = { feature: GuidedFeature; onClose: () => void };

/** Parcours en étapes : Personne → Produit → Texte → Lancer. La création part directement, sans barre de saisie. */
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
  const [busy, setBusy] = useState(false);
  const run = useServerFn(generateMedia);
  const writeCopy = useServerFn(generateAdCopy);
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [benefits, setBenefits] = useState("");
  const [audience, setAudience] = useState("");
  const [objective, setObjective] = useState("");
  const [writing, setWriting] = useState(false);

  const fillCopy = async () => {
    if (productName.trim().length < 2) {
      toast.error("Donne d'abord le nom du produit.");
      return;
    }
    setWriting(true);
    try {
      const res = await writeCopy({
        data: {
          product: productName,
          price,
          description,
          benefits,
          audience,
          objective,
          language: "français",
          format: feature.mediaType === "video" ? "vidéo publicitaire" : "image promotionnelle",
        },
      });
      if (res.ok) setText(res.text);
      else toast.error(res.message);
    } catch {
      toast.error("Le texte n'a pas pu être écrit. Réessaie dans un instant.");
    } finally {
      setWriting(false);
    }
  };
  const current = steps[step];

  const readFile = (cb: (s: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" && cb(reader.result);
    reader.readAsDataURL(file);
  };

  const blocker =
    current === "Personne" && !person
      ? "Choisis d'abord une personne."
      : current === "Produit" && !product
        ? "Ajoute d'abord une photo du produit."
        : current === "Texte" && text.trim().length < 10
          ? "Décris ce que tu veux dans le texte."
          : null;

  const launch = async () => {
    setBusy(true);
    const images = [person, product].filter((x): x is string => !!x);
    const creatorMode =
      feature.mediaType === "video" && feature.modelId
        ? feature.videoMode === "image_to_video" ? "image" : "text"
        : null;
    try {
      const res = await run({
        data: {
          prompt: text,
          mediaType: feature.mediaType,
          resolution: "720p",
          duration: feature.mediaType === "video" ? "8s" : "",
          aspectRatio: "9:16",
          imageUrl: images[0] ?? null,
          imageUrls: images,
          creatorMode,
          model: feature.modelId ?? null,
          project_id: null,
          wallet: "seller",
        } as never,
      });
      if (res.ok) {
        toast.success("Création lancée. Tu la retrouveras dans Créations.");
        onClose();
      } else {
        toast.error(res.message ?? "La création n'a pas pu démarrer. Tes crédits ne sont pas décomptés.");
      }
    } catch {
      toast.error("La création n'a pas pu démarrer. Tes crédits ne sont pas décomptés.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end bg-black/60" role="dialog" aria-label={feature.title}>
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-background p-5 text-foreground">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-semibold">{feature.title}</p>
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground">Fermer</button>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
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
          <div className="space-y-3">
            <div className="grid gap-2">
              <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Nom du produit" maxLength={120} className="rounded-2xl border border-border bg-card p-3 text-sm outline-none" />
              <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Prix (ex. 15 000 FC)" maxLength={60} className="rounded-2xl border border-border bg-card p-3 text-sm outline-none" />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description du produit" rows={2} maxLength={800} className="rounded-2xl border border-border bg-card p-3 text-sm outline-none" />
              <input value={benefits} onChange={(e) => setBenefits(e.target.value)} placeholder="Avantages (séparés par des virgules)" maxLength={500} className="rounded-2xl border border-border bg-card p-3 text-sm outline-none" />
              <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Public cible (ex. mamans à Kinshasa)" maxLength={200} className="rounded-2xl border border-border bg-card p-3 text-sm outline-none" />
              <input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Objectif (ex. vendre, faire connaître)" maxLength={200} className="rounded-2xl border border-border bg-card p-3 text-sm outline-none" />
            </div>
            <button type="button" disabled={writing} onClick={() => void fillCopy()} className="w-full rounded-full border border-primary py-3 text-sm font-semibold text-primary disabled:opacity-40">
              {writing ? "Rédaction…" : "Écrire le texte avec l'IA"}
            </button>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} className="w-full rounded-2xl border border-border bg-card p-3 text-sm outline-none" />
          </div>
        )}
        {current === "Lancer" && (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Ta création part avec : {person ? "une personne" : "aucune personne"}, {product ? "ton produit" : "aucun produit"}.</p>
          </div>
        )}

        {blocker && <p className="mt-4 text-sm text-amber-600 dark:text-amber-300">{blocker}</p>}
        <div className="mt-5 flex gap-3">
          <button type="button" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)} className="flex-1 rounded-full border border-border py-3 text-sm disabled:opacity-40">
            Retour
          </button>
          {step < steps.length - 1 ? (
            <button type="button" disabled={!!blocker} onClick={() => setStep((s) => s + 1)} className="flex-1 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">
              Continuer
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={() => void launch()} className="flex-1 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">
              {busy ? "Lancement…" : "Lancer la création"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
