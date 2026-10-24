import { useState } from "react";
import { SellerGuidedFlow, type GuidedFeature } from "@/components/samflash/SellerGuidedFlow";
import { ImageIcon, Video, Info } from "lucide-react";
import { generationCreditsFor } from "@/lib/creator-pricing";

type VideoModeId = "text_to_video" | "image_to_video" | "video_edit";

type Feature = {
  title: string;
  desc: string;
  starter: string;
  mediaType: "image" | "video";
  modelId?: string;
  videoMode?: VideoModeId;
  /** Photo de personne requise : l'utilisateur doit confirmer ses droits. */
  needsPhotoRights?: boolean;
  /** Coût affiché avant le clic, en crédits Sam Flash (calculé par le barème). */
  costLabel?: string;
};

// Coût de départ : Seedance 2.0 à 720p sur 5 s ; Veo 3.1 à 720p (prix fixe par vidéo).
const SEEDANCE_FROM = generationCreditsFor("seedance-2", "720p", 5);
const VEO_FROM = generationCreditsFor("veo-3-1", "720p", 8);
const costText = (n: number | null) => (n === null ? undefined : `Dès ${n} crédits`);

const IMAGE_FEATURES: Feature[] = [
  {
    title: "Cloner une publicité",
    desc: "Une image qui marche déjà, refaite avec ton produit et ton décor.",
    starter: "Reprends la mise en scène de cette publicité et remplace le produit par le mien : ",
    mediaType: "image",
  },
  {
    title: "Une perruque portée",
    desc: "Ta perruque sur la tête de quelqu'un. De face, de dos, sur le fond que tu veux.",
    starter: "Montre une femme portant cette perruque, de face, sur un fond : ",
    mediaType: "image",
    needsPhotoRights: true,
  },
  {
    title: "Habiller un mannequin",
    desc: "Ta pièce portée debout, sur le fond de ton choix. Prête pour la fiche produit.",
    starter: "Habille un mannequin avec cette pièce, debout, sur un fond : ",
    mediaType: "image",
  },
  {
    title: "Un produit en main",
    desc: "Ton parfum, ta montre, ton bijou, tenu par quelqu'un, sur le décor que tu choisis.",
    starter: "Présente mon produit tenu en main par une personne, sur ce décor : ",
    mediaType: "image",
    needsPhotoRights: true,
  },
];

const VIDEO_FEATURES: Feature[] = [
  {
    title: "Publicité UGC dynamique",
    desc: "Un clip façon témoignage client, avec ton produit en main.",
    starter: "Crée une publicité UGC dynamique où une personne présente mon produit : ",
    mediaType: "video",
    modelId: "veo-3-1",
    videoMode: "image_to_video",
    needsPhotoRights: true,
    costLabel: costText(VEO_FROM),
  },
  {
    title: "Pub voix off",
    desc: "Une publicité avec voix off qui présente ton produit.",
    starter: "Crée une publicité avec voix off qui présente mon produit : ",
    mediaType: "video",
    modelId: "veo-3-1",
    videoMode: "text_to_video",
    costLabel: costText(VEO_FROM),
  },
  {
    title: "Clonage vidéo",
    desc: "Reprends une vidéo qui marche et remplace le produit ou la personne.",
    starter: "Reprends le style de cette vidéo et remplace le produit par le mien : ",
    mediaType: "video",
    modelId: "seedance-2",
    videoMode: "video_edit",
    costLabel: costText(SEEDANCE_FROM),
  },
  {
    title: "Rejouer une pub",
    desc: "Refais une publicité qui performe, avec tes propres visuels.",
    starter: "Rejoue cette publicité avec mon produit et mes visuels : ",
    mediaType: "video",
    modelId: "seedance-2",
    videoMode: "video_edit",
    costLabel: costText(SEEDANCE_FROM),
  },
  {
    title: "Changer le produit",
    desc: "Remplace le produit dans une vidéo existante, là où il apparaît.",
    starter: "Dans cette vidéo, remplace le produit par le mien : ",
    mediaType: "video",
    modelId: "seedance-2",
    videoMode: "video_edit",
    costLabel: costText(SEEDANCE_FROM),
  },
];

function FeatureCard({
  f,
  allowed,
  onPick,
}: {
  f: Feature;
  allowed: boolean;
  onPick: (f: Feature) => void;
}) {
  const soon = SOON.has(f.title);
  const blocked = (f.needsPhotoRights && !allowed) || soon;
  return (
    <button
      type="button"
      onClick={() => !blocked && onPick(f)}
      aria-disabled={blocked}
      className={`flex flex-col items-start gap-2 rounded-3xl border border-border bg-card p-4 text-left transition-transform active:scale-[0.98] ${
        blocked ? "opacity-50" : ""
      }`}
    >
      <span className="flex w-full items-center justify-between gap-2 text-[15px] font-semibold text-foreground">
        {f.title}
        <span aria-hidden className="text-muted-foreground">→</span>
      </span>
      <span className="text-sm text-muted-foreground">{f.desc}</span>
      {f.costLabel && <span className="text-xs font-semibold text-primary">{f.costLabel}</span>}
      {soon && <span className="text-xs text-muted-foreground">Bientôt disponible.</span>}
      {!soon && f.needsPhotoRights && !allowed && <span className="text-xs text-muted-foreground">Coche d'abord la case des droits ci-dessus.</span>}
    </button>
  );
}

/** Styles de pub (Créative AI) : même parcours que les autres cartes vidéo. */
const STYLE_FEATURES: Feature[] = [
  { title: "Histoire racontée", desc: "Une personne vit l'histoire avec ton produit, sans parler. Une voix off la raconte.", starter: "Une personne vit une histoire avec mon produit, sans parler, avec une voix off qui raconte avant et après : ", mediaType: "video", modelId: "veo-3-1", videoMode: "image_to_video" },
  { title: "UGC", desc: "Une personne montre ton produit au téléphone, dans une vraie pièce, comme une cliente qui filme.", starter: "Une personne montre mon produit au téléphone, dans une vraie pièce, comme une cliente qui filme : ", mediaType: "video", modelId: "veo-3-1", videoMode: "image_to_video" },
  { title: "Pub animée", desc: "Le directeur invente un univers animé pour ton produit. Une voix off raconte.", starter: "Un univers animé pour mon produit, avec une voix off qui raconte les bienfaits : ", mediaType: "video", modelId: "veo-3-1", videoMode: "text_to_video" },
  { title: "Professionnel", desc: "Ton produit seul, sur un plateau net, filmé comme une marque. Aucune personne à l'écran.", starter: "Mon produit seul, sur un plateau net, filmé comme une marque, sans personne : ", mediaType: "video", modelId: "veo-3-1", videoMode: "image_to_video" },
  { title: "Avant / après", desc: "Le problème d'un côté, la solution de l'autre.", starter: "Le problème d'un côté, la solution avec mon produit de l'autre : ", mediaType: "video", modelId: "veo-3-1", videoMode: "image_to_video" },
  { title: "Témoignage", desc: "Un client raconte son expérience face caméra.", starter: "Un client raconte son expérience avec mon produit, face caméra : ", mediaType: "video", modelId: "veo-3-1", videoMode: "image_to_video" },
  { title: "Publicité produit", desc: "Un visuel soigné, lumière douce, fond épuré.", starter: "Une publicité produit soignée, lumière douce, fond épuré : ", mediaType: "video", modelId: "veo-3-1", videoMode: "image_to_video" },
  { title: "Promotion", desc: "Une offre claire, avec un prix et un appel à l'action.", starter: "Une promotion claire avec mon offre, un prix et un appel à l'action : ", mediaType: "video", modelId: "veo-3-1", videoMode: "image_to_video" },
];

/** Cartes qui passent par le parcours en étapes (photos à fournir). */
const GUIDED: Record<string, { needsPerson: boolean; needsProduct: boolean }> = {
  "Cloner une publicité": { needsPerson: false, needsProduct: true },
  "Une perruque portée": { needsPerson: true, needsProduct: true },
  "Habiller un mannequin": { needsPerson: false, needsProduct: true },
  "Un produit en main": { needsPerson: true, needsProduct: true },
  "Publicité UGC dynamique": { needsPerson: true, needsProduct: true },
  "Pub voix off": { needsPerson: false, needsProduct: false },
  "Histoire racontée": { needsPerson: true, needsProduct: true },
  "UGC": { needsPerson: true, needsProduct: true },
  "Pub animée": { needsPerson: false, needsProduct: false },
  "Professionnel": { needsPerson: false, needsProduct: true },
  "Avant / après": { needsPerson: false, needsProduct: true },
  "Témoignage": { needsPerson: true, needsProduct: true },
  "Publicité produit": { needsPerson: false, needsProduct: true },
  "Promotion": { needsPerson: false, needsProduct: true },
};

/** Cartes pas encore branchées : elles affichent « Bientôt disponible ». */
const SOON = new Set(["Clonage vidéo", "Rejouer une pub", "Changer le produit"]);

/** Espace vendeur : cartes Image et Vidéo, comme sur Vizuely. */
export function SellerStudio() {
  const [rightsOk, setRightsOk] = useState(false);

  const [guided, setGuided] = useState<GuidedFeature | null>(null);

  const pick = (f: Feature) => {
    const g = GUIDED[f.title];
    if (!g) return;
    setGuided({
      title: f.title,
      starter: f.starter,
      mediaType: f.mediaType,
      modelId: f.modelId,
      videoMode: f.videoMode === "image_to_video" ? "image_to_video" : f.videoMode === "text_to_video" ? "text_to_video" : undefined,
      needsPerson: g.needsPerson,
      needsProduct: g.needsProduct,
    });
  };

  return (
    <div className="w-full max-w-2xl px-4 mb-6 space-y-6">
      <label className="flex items-start gap-3 rounded-3xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={rightsOk}
          onChange={(e) => setRightsOk(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span className="flex gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <span>
            J'ai le droit d'utiliser ces photos : elles sont les miennes ou celles d'une personne qui m'a donné son accord.
            Les stars, artistes, influenceurs et photos trouvées sur internet sont interdits.
          </span>
        </span>
      </label>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
          <Video className="h-4 w-4" /> Styles de pub
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {STYLE_FEATURES.map((f) => (
            <FeatureCard key={f.title} f={f} allowed={rightsOk} onPick={pick} />
          ))}
        </div>
      </section>

      {guided && <SellerGuidedFlow feature={guided} onClose={() => setGuided(null)} />}

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
          <ImageIcon className="h-4 w-4" /> Image
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {IMAGE_FEATURES.map((f) => (
            <FeatureCard key={f.title} f={f} allowed={rightsOk} onPick={pick} />
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
          <Video className="h-4 w-4" /> Vidéo
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {VIDEO_FEATURES.map((f) => (
            <FeatureCard key={f.title} f={f} allowed={rightsOk} onPick={pick} />
          ))}
        </div>
      </section>
    </div>
  );
}
