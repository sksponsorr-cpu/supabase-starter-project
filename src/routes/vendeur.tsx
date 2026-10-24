import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Image as ImageIcon, Video, Package, Monitor } from "lucide-react";
import { SellerSidebar } from "@/components/samflash/SellerSidebar";
import { SellerGuidedFlow, type GuidedFeature } from "@/components/samflash/SellerGuidedFlow";
import { generationCreditsFor } from "@/lib/creator-pricing";
import { listSellerCardImages } from "@/lib/seller-card-images.functions";
import { IMAGE_AD_PRESETS, type ImageAdPreset } from "@/lib/image-ad-presets";
import { ImageAdFlow } from "@/components/samflash/ImageAdFlow";
import { SellerCreditsPill } from "@/components/samflash/SellerCreditsPanel";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";

export const Route = createFileRoute("/vendeur")({
  head: () => ({ meta: [{ title: "Espace vendeur — Sam flash 2.0" }] }),
  component: VendeurPage,
});

type Style = {
  title: string;
  desc: string;
  ideal: string;
  starter: string;
  needsPerson: boolean;
  needsProduct: boolean;
  videoMode: "text_to_video" | "image_to_video";
  tint: string;
};

/** Styles de pub (même présentation que Créative AI). */
const STYLES: Style[] = [
  { title: "Histoire racontée", desc: "Une personne vit l'histoire avec ton produit, sans parler. Une voix off la raconte, avant et après.", ideal: "beauté, santé, bien-être, tout produit qui change le quotidien", starter: "Une personne vit une histoire avec mon produit, sans parler, avec une voix off qui raconte avant et après : ", needsPerson: true, needsProduct: true, videoMode: "image_to_video", tint: "from-fuchsia-600/40 to-purple-900/40" },
  { title: "UGC", desc: "Une personne montre ton produit au téléphone, dans une vraie pièce, comme une cliente qui filme.", ideal: "mode, cosmétique, gadgets, produits qui se montrent en main", starter: "Une personne montre mon produit au téléphone, dans une vraie pièce, comme une cliente qui filme : ", needsPerson: true, needsProduct: true, videoMode: "image_to_video", tint: "from-amber-500/40 to-orange-900/40" },
  { title: "Pub animée", desc: "Un univers animé invente un monde pour ton produit. Une voix off raconte.", ideal: "se démarquer, expliquer un bienfait, capter l'œil dès la première seconde", starter: "Un univers animé pour mon produit, avec une voix off qui raconte les bienfaits : ", needsPerson: false, needsProduct: false, videoMode: "text_to_video", tint: "from-emerald-500/40 to-teal-900/40" },
  { title: "Professionnel", desc: "Ton produit seul, sur un plateau net, filmé comme une marque. Aucune personne à l'écran.", ideal: "produits premium, électronique, packs, catalogue", starter: "Mon produit seul, sur un plateau net, filmé comme une marque, sans personne : ", needsPerson: false, needsProduct: true, videoMode: "image_to_video", tint: "from-violet-500/40 to-indigo-900/40" },
  { title: "Avant / après", desc: "Le problème d'un côté, la solution de l'autre.", ideal: "démontrer un résultat visible", starter: "Le problème d'un côté, la solution avec mon produit de l'autre : ", needsPerson: false, needsProduct: true, videoMode: "image_to_video", tint: "from-teal-500/40 to-cyan-900/40" },
  { title: "Témoignage", desc: "Un client raconte son expérience face caméra.", ideal: "faire confiance, rassurer", starter: "Un client raconte son expérience avec mon produit, face caméra : ", needsPerson: true, needsProduct: true, videoMode: "image_to_video", tint: "from-rose-500/40 to-pink-900/40" },
  { title: "Publicité produit", desc: "Un visuel soigné, lumière douce, fond épuré.", ideal: "mettre en valeur un objet", starter: "Une publicité produit soignée, lumière douce, fond épuré : ", needsPerson: false, needsProduct: true, videoMode: "image_to_video", tint: "from-sky-500/40 to-blue-900/40" },
  { title: "Promotion", desc: "Une offre claire, avec un prix et un appel à l'action.", ideal: "lancer une offre, une promo ou une remise", starter: "Une promotion claire avec mon offre, un prix et un appel à l'action : ", needsPerson: false, needsProduct: true, videoMode: "image_to_video", tint: "from-red-500/40 to-rose-900/40" },
];

const fmt = (n: number | null) => (n === null ? "—" : `${n} crédits`);

function VendeurPage() {
  const [kind, setKind] = useState<"images" | "videos">("videos");
  const [product, setProduct] = useState<"physique" | "digital">("physique");
  const [active, setActive] = useState<GuidedFeature | null>(null);
  const [imagePreset, setImagePreset] = useState<ImageAdPreset | null>(null);
  const loadImages = useServerFn(listSellerCardImages);
  const [cardImages, setCardImages] = useState<Record<string, string>>({});
  useEffect(() => { void loadImages({}).then(setCardImages).catch(() => setCardImages({})); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const slug = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Prix de départ affichés sur chaque carte (même barème que la génération).
  const videoFrom = generationCreditsFor("veo-3-1", "720p", 8);

  const open = (s: Style) =>
    setActive({
      title: s.title,
      starter: s.starter,
      mediaType: "video",
      modelId: "veo-3-1",
      videoMode: s.videoMode,
      needsPerson: s.needsPerson,
      needsProduct: s.needsProduct,
    });

  return (
    <div className="flex min-h-screen bg-[#0a0a14] text-white">
      <SellerSidebar />
      <main className="mx-auto w-full max-w-md px-5 pb-20 pt-16">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.25em] text-white/50">Espace vendeur</p>
          <SellerCreditsPill />
        </div>
        <h1 className="mt-3 text-center text-3xl font-bold tracking-tight">Qu'allons-nous vendre aujourd'hui ?</h1>
        <p className="mt-2 text-center text-sm text-white/60">Choisis le type de pub : le formulaire s'adapte à ce choix.</p>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-full bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setKind("images")}
            className={`flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold ${kind === "images" ? "bg-white/10 text-white" : "text-white/50"}`}
          >
            <ImageIcon className="h-4 w-4" /> Créatives images
          </button>
          <button
            type="button"
            onClick={() => setKind("videos")}
            className={`flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold ${kind === "videos" ? "bg-violet-600 text-white" : "text-white/50"}`}
          >
            <Video className="h-4 w-4" /> Créatives vidéo
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-white/50">Ton produit est</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setProduct("physique")}
            className={`flex items-center justify-center gap-2 rounded-full border py-2.5 text-sm ${product === "physique" ? "border-violet-500 text-violet-300" : "border-white/10 text-white/60"}`}
          >
            <Package className="h-4 w-4" /> Un produit physique
          </button>
          <button
            type="button"
            onClick={() => setProduct("digital")}
            className={`flex items-center justify-center gap-2 rounded-full border py-2.5 text-sm ${product === "digital" ? "border-violet-500 text-violet-300" : "border-white/10 text-white/60"}`}
          >
            <Monitor className="h-4 w-4" /> Un produit digital
          </button>
        </div>

        {kind === "videos" ? (
          <ul className="mt-8 space-y-5">
            {STYLES.map((s) => (
              <li key={s.title}>
                <button
                  type="button"
                  onClick={() => open(s)}
                  className="block w-full overflow-hidden rounded-3xl border border-white/10 bg-[#11111c] text-left transition-transform active:scale-[0.99]"
                >
                  {cardImages[slug(s.title)] ? (
                    <img src={cardImages[slug(s.title)]} alt={s.title} className="h-44 w-full object-cover" />
                  ) : (
                    <div className={`flex h-44 items-center justify-center bg-gradient-to-br ${s.tint}`}>
                      <Video className="h-10 w-10 text-white/70" />
                    </div>
                  )}
                  <div className="p-5">
                    <p className="text-lg font-semibold">{s.title}</p>
                    <p className="mt-1 text-sm text-white/65">{s.desc}</p>
                    <p className="mt-3 text-sm text-white/50">
                      <span className="text-white/70">Idéal pour</span> {s.ideal}
                    </p>
                    <p className="mt-4 text-sm font-semibold text-violet-400">À partir de {fmt(videoFrom)} →</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="mt-8 space-y-5">
            {IMAGE_AD_PRESETS.map((p) => (
              <li key={p.key}>
                <button
                  type="button"
                  onClick={() => setImagePreset(p)}
                  className="block w-full overflow-hidden rounded-3xl border border-white/10 bg-[#11111c] text-left transition-transform active:scale-[0.99]"
                >
                  <div className="flex h-44 items-center justify-center bg-gradient-to-br from-violet-500/30 to-fuchsia-900/30">
                    <ImageIcon className="h-10 w-10 text-white/70" />
                  </div>
                  <div className="p-5">
                    <p className="text-lg font-semibold">{p.title}</p>
                    <p className="mt-1 text-sm text-white/65">{p.desc}</p>
                    <p className="mt-3 text-sm text-white/50"><span className="text-white/70">Idéal pour</span> {p.ideal}</p>
                    <p className="mt-4 text-sm font-semibold text-violet-400">Photo de ton produit → création →</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {imagePreset && <ImageAdFlow preset={imagePreset} onClose={() => setImagePreset(null)} />}
      {active && <SellerGuidedFlow feature={active} onClose={() => setActive(null)} />}
    </div>
  );
}
