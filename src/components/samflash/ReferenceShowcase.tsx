/**
 * Page de référence affichée après le choix du parcours.
 * - Vidéo principale, étapes, résultats : gérés depuis le bureau d'administrateur
 *   (bloc « Vitrine de la page de référence », catégories « pub » et « clone »).
 * - Galerie : vidéos approuvées de la galerie communautaire, lisibles au clic.
 * - « Commencer » et « Quitter » ouvrent le modèle choisi.
 */
import { VideoTile } from "./VideoTile";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getLanding } from "@/lib/landing.functions";
import { listCommunityGallery, type CommunityItem } from "@/lib/community.functions";
import { playClick } from "@/lib/chime";
import type { Parcours } from "@/components/samflash/WelcomeGate";

type ShowcaseItem = { url: string; caption: string };

export type Template = {
  category: "pub" | "clone";
  eyebrow: string;
  title: string;
  text: string;
  steps: [string, string, string, string];
  resultsTitle: string;
  resultsText: string;
  cta: string;
  target: "/app" | "/clonage-video";
};

/** Contenu de chaque parcours. À valider avant publication. */
export const TEMPLATES: Record<Parcours, Template> = {
  generation: {
    category: "pub",
    eyebrow: "Témoignage vidéo",
    title: "Une vraie personne présente ton produit.",
    text: "Avec Sam Flash 2.0, créez des vidéos professionnelles, simples à lire et au rendu soigné. Payez facilement avec Mobile Money, sans carte bancaire.",
    steps: ["Mobile Money", "Sans carte bancaire", "Vidéo en minutes", "Sans tournage"],
    resultsTitle: "Des résultats concrets",
    resultsText: "Voici les revenus générés grâce à la monétisation de vidéos IA.",
    cta: "Continuer",
    target: "/app",
  },
  clonage: {
    category: "clone",
    eyebrow: "Clonage vidéo",
    title: "Reproduisez un mouvement à partir d'une vidéo.",
    text: "Partez d'une vidéo de référence : la gestuelle est reproduite sur la personne de votre choix.",
    steps: ["Vidéo de référence", "Le mouvement", "La personne", "Le résultat"],
    resultsTitle: "Des résultats concrets",
    resultsText: "Voici des clonages réalisés avec Sam Flash 2.0, à partir de vraies vidéos de référence.",
    cta: "Commencer mon clonage",
    target: "/clonage-video",
  },
};

const ACCENT = "var(--sf-accent, #6d28d9)";

type Props = {
  parcours: Parcours;
  /** Appelé avec la page de destination (le modèle choisi). */
  onGo: (path: "/app" | "/clonage-video") => void;
};

export function ReferenceShowcase({ parcours, onGo }: Props) {
  const template = TEMPLATES[parcours];
  const fetchLanding = useServerFn(getLanding);
  const fetchGallery = useServerFn(listCommunityGallery);
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [revenue, setRevenue] = useState<{ referenceVideo: string; images: { url: string; caption: string }[] } | null>(null);
  const [gallery, setGallery] = useState<CommunityItem[] | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryAll, setGalleryAll] = useState(false);
  const [playing, setPlaying] = useState<CommunityItem | null>(null);

  useEffect(() => {
    let alive = true;
    fetchLanding()
      .then((d) => {
        if (alive) {
          setItems((d.showcase ?? []).filter((v) => v.cat === template.category));
          setRevenue(d.revenue ?? null);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [fetchLanding, template.category]);

  const openGallery = () => {
    playClick();
    setShowGallery(true);
    if (gallery !== null) return;
    fetchGallery({})
      .then((rows) => setGallery(rows as CommunityItem[]))
      .catch(() => setGallery([]));
  };

  const main = items[0];
  const refVideo = revenue?.referenceVideo || main?.url || "";
  const results = items.slice(1);

  return (
    <>
      <div className="w-full max-w-md text-left pt-6">
        <p className="mt-16 text-[13px] font-semibold uppercase tracking-[0.2em]" style={{ animationDelay: "120ms", color: ACCENT }}>
          {template.eyebrow}
        </p>
        <h2 className="mt-3 text-[30px] font-extrabold leading-[1.08] tracking-tight" style={{ animationDelay: "180ms" }}>
          {template.title}
        </h2>
        <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground" style={{ animationDelay: "240ms" }}>
          {template.text}
        </p>

        {/* Vidéo de référence */}
        <div className="motion-apple-video relative aspect-video w-full overflow-hidden rounded-[24px] bg-black mt-6">
          {refVideo ? (
            <video src={refVideo} className="pointer-events-none h-full w-full object-contain" autoPlay loop muted playsInline preload="metadata" controlsList="nodownload nofullscreen noremoteplayback" disablePictureInPicture disableRemotePlayback onContextMenu={(e) => e.preventDefault()} />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/70">
              La vidéo de présentation sera ajoutée prochainement.
            </div>
          )}
        </div>

        {/* Les quatre étapes, en pilules numérotées */}
        <div className="mt-7 grid grid-cols-2 gap-3">
          <style>{`@keyframes sfFloat{0%,100%{transform:translateY(0);box-shadow:0 0 0 rgba(124,58,237,0)}50%{transform:translateY(-4px);box-shadow:0 10px 24px -12px rgba(124,58,237,.55)}}`}</style>
          {template.steps.map((label, i) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-full bg-secondary/70 px-5 py-4"
              style={{ animation: `sfFloat 3.6s ease-in-out ${i * 0.45}s infinite` }}
            >
              <span className="text-[15px] font-bold" style={{ color: ACCENT }}>
                0{i + 1}
              </span>
              <span className="text-[15px] font-semibold leading-tight">{label}</span>
            </div>
          ))}
        </div>

        {/* Résultats : texte et captures côte à côte */}


        {revenue && revenue.images.length === 0 && (
          <section className="mt-10">
            <h3 className="text-[22px] font-bold tracking-tight">Revenus générés</h3>
            <p className="mt-2 text-sm text-muted-foreground">Les revenus seront ajoutés prochainement.</p>
          </section>
        )}
        {revenue && revenue.images.length > 0 && (
          <section className="mt-10" style={{ animationDelay: "560ms" }}>
            <h3 className="text-[22px] font-bold tracking-tight">Revenus générés</h3>
            <p className="mt-1 text-sm text-muted-foreground">Des revenus réellement générés avec la monétisation de vidéos IA.</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {revenue.images.map((img) => (
                <figure key={img.url} className="overflow-hidden rounded-2xl bg-secondary/50">
                  <img src={img.url} alt={img.caption || "Revenu"} loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
                  {img.caption && <figcaption className="px-3 py-2 text-xs text-muted-foreground">{img.caption}</figcaption>}
                </figure>
              ))}
            </div>
          </section>
        )}

        

        {/* Bouton principal */}
        <button
          type="button"
          onClick={() => {
            playClick();
            if (template.cta === "Continuer") openGallery();
            else onGo(template.target);
          }}
          className="motion-apple-tap motion-apple mt-4 flex w-full items-center justify-center gap-3 rounded-full bg-foreground py-5 text-[17px] font-semibold text-background shadow-lg"
          style={{ animationDelay: "700ms" }}
        >
          {template.cta}
          <span aria-hidden>→</span>
        </button>
      </div>

      {/* Galerie plein écran : toutes les vidéos générées et approuvées */}
      {showGallery && (
        <div className="fixed inset-0 z-[110] flex flex-col bg-background overflow-hidden pt-[calc(env(safe-area-inset-top,0px)+1.5rem)]">
        
          <div className="flex items-center justify-between border-b border-border px-5 pb-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)] bg-background sticky top-0 z-10">
            <h2 className="text-lg font-bold">Galerie des créations</h2>
            <button
              type="button"
              onClick={() => {
                playClick();
                onGo(template.target);
              }}
              className="motion-apple-tap rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              Quitter
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {gallery === null ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Chargement…</p>
            ) : gallery.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Aucune création publiée pour le moment.</p>
            ) : (
              <>
              <div className="px-5 pt-5 pb-2 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: ACCENT }}>Créations de la communauté</p>
            <h3 className="mt-2 text-[22px] font-bold leading-tight">Vidéos générées avec Sam Flash 2.0</h3>
            <p className="mt-2 text-sm text-muted-foreground">Créées par nos utilisateurs déjà inscrits.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
                {(galleryAll ? gallery : gallery.slice(0, 6)).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      playClick();
                      setPlaying(g);
                    }}
                    className="motion-apple-tap relative overflow-hidden rounded-2xl bg-black text-left"
                  >
                    {g.media_type === "video" && g.media_url ? (
                      <VideoTile src={g.media_url} className="aspect-[9/12] w-full object-cover" />
                    ) : g.media_url ? (
                      <img src={g.media_url} alt={g.prompt} className="aspect-[9/12] w-full object-cover" loading="lazy" />
                    ) : null}
                    {g.media_type === "video" && (
                      <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold text-white">▶ Vidéo</span>
                    )}
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-[11px] text-white line-clamp-2">
                      {g.prompt}
                    </span>
                  </button>
                ))}
              {!galleryAll && gallery.length > 6 && (
                <button
                  type="button"
                  onClick={() => setGalleryAll(true)}
                  className="col-span-full mt-2 w-full rounded-full border border-border py-3 text-sm font-semibold"
                >
                  Voir plus ({gallery.length - 6} autres)
                </button>
              )}
              </div>
              </>
            )}
          </div>

          <div className="fixed inset-x-0 bottom-0 z-[125] bg-background/95 p-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] backdrop-blur">
            <button type="button" onClick={() => { playClick(); onGo(template.target); }} className="w-full rounded-full bg-foreground py-4 text-[16px] font-semibold text-background">
              Quitter la galerie
            </button>
          </div>

          {/* Lecteur au clic */}
          {playing && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4" onClick={() => setPlaying(null)}>
              <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                {playing.media_type === "video" && playing.media_url ? (
                  <video src={playing.media_url} autoPlay loop playsInline className="max-h-[75vh] w-full rounded-2xl bg-black" controlsList="nodownload nofullscreen noremoteplayback" disablePictureInPicture disableRemotePlayback onContextMenu={(e) => e.preventDefault()} />
                ) : playing.media_url ? (
                  <img src={playing.media_url} alt={playing.prompt} className="max-h-[75vh] w-full rounded-2xl object-contain" />
                ) : null}
                <button type="button" onClick={() => setPlaying(null)} className="motion-apple-tap mt-4 w-full rounded-full border border-white/30 py-3 text-sm font-semibold text-white">
                  Fermer
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
