import { ImageIcon, Video } from "lucide-react";

type Feature = {
  title: string;
  desc: string;
  starter: string;
  mediaType: "image" | "video";
  modelId?: string;
  videoMode?: "text_to_video" | "image_to_video" | "video_edit";
};

/** Fonctionnalités vendeur / e-commerçant. Un clic pré-remplit la barre de saisie. */
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
  },
  {
    title: "Pub voix off",
    desc: "Une publicité avec voix off qui présente ton produit.",
    starter: "Crée une publicité avec voix off qui présente mon produit : ",
    mediaType: "video",
    modelId: "veo-3-1",
    videoMode: "text_to_video",
  },
  {
    title: "Clonage vidéo",
    desc: "Reprends une vidéo qui marche et remplace le produit ou la personne.",
    starter: "Reprends le style de cette vidéo et remplace le produit par le mien : ",
    mediaType: "video",
    modelId: "seedance-2",
    videoMode: "video_edit",
  },
  {
    title: "Rejouer une pub",
    desc: "Refais une publicité qui performe, avec tes propres visuels.",
    starter: "Rejoue cette publicité avec mon produit et mes visuels : ",
    mediaType: "video",
    modelId: "seedance-2",
    videoMode: "video_edit",
  },
  {
    title: "Changer le produit",
    desc: "Remplace le produit dans une vidéo existante, là où il apparaît.",
    starter: "Dans cette vidéo, remplace le produit par le mien : ",
    mediaType: "video",
    modelId: "seedance-2",
    videoMode: "video_edit",
  },
];

function FeatureCard({ f, onPick }: { f: Feature; onPick: (f: Feature) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(f)}
      className="flex flex-col items-start gap-2 rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-left transition-transform active:scale-[0.98]"
    >
      <span className="flex w-full items-center justify-between gap-2 text-[15px] font-semibold text-white">
        {f.title}
        <span aria-hidden className="text-white/50">→</span>
      </span>
      <span className="text-sm text-white/60">{f.desc}</span>
    </button>
  );
}

/** Espace vendeur : cartes Image et Vidéo, comme sur Vizuely. */
export function SellerStudio() {
  const pick = (f: Feature) => {
    window.dispatchEvent(new CustomEvent("samflash:seller-preset", { detail: f }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="w-full max-w-2xl px-4 mb-6 space-y-6">
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-white">
          <ImageIcon className="h-4 w-4" /> Image
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {IMAGE_FEATURES.map((f) => (
            <FeatureCard key={f.title} f={f} onPick={pick} />
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-white">
          <Video className="h-4 w-4" /> Vidéo
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {VIDEO_FEATURES.map((f) => (
            <FeatureCard key={f.title} f={f} onPick={pick} />
          ))}
        </div>
      </section>
    </div>
  );
}
