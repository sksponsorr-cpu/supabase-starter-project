/**
 * Page de référence affichée après le choix du parcours.
 * - Vidéo principale, étapes, résultats : gérés depuis le bureau d'administrateur
 *   (bloc « Vitrine de la page de référence », catégories « pub » et « clone »).
 * - Galerie : vidéos approuvées de la galerie communautaire, lisibles au clic.
 * - « Commencer » et « Quitter » ouvrent le modèle choisi.
 */
import { VideoTile } from "./VideoTile";
import { useEffect, useState, useRef} from "react";
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


/** Vidéo de référence muette, en boucle, avec bouton pause / lecture.
 *  Se met en pause toute seule hors écran ou quand la galerie est ouverte (fluidité). */
function PausableVideo({ src, hold }: { src: string; hold?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (userPaused || hold || !inView) v.pause();
    else void v.play().catch(() => {});
  }, [userPaused, hold, inView]);

  return (
    <div className="relative h-full w-full">
      <video
        ref={ref}
        src={src}
        className="pointer-events-none h-full w-full object-contain"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        disablePictureInPicture
        controlsList="nodownload nofullscreen noremoteplayback"
        onContextMenu={(e) => e.preventDefault()}
      />
      <button
        type="button"
        aria-label={userPaused ? "Lire la vidéo" : "Mettre en pause"}
        onClick={() => setUserPaused((p) => !p)}
        className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white"
      >
        {userPaused ? "▶ Lire" : "❚❚ Pause"}
      </button>
    </div>
  );
}

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
      <div className="w-full max-w-md text-left pt-1">
        <p className="sf-reveal text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ ["--d" as string]: "60ms", color: ACCENT }}>
          {template.eyebrow}
        </p>
        <h2 className="sf-reveal mt-1.5 text-[20px] font-extrabold leading-[1.15] tracking-tight" style={{ ["--d" as string]: "120ms" }}>
          {template.title}
        </h2>
        <p className="sf-reveal mt-2 text-[14px] leading-snug text-muted-foreground" style={{ ["--d" as string]: "180ms" }}>
          {template.text}
        </p>

        {/* Vidéo de référence */}
        <div className="sf-reveal relative mt-4 aspect-video w-full overflow-hidden rounded-[20px] bg-black" style={{ ["--d" as string]: "240ms" }}>
          {refVideo ? (
            <PausableVideo src={refVideo} hold={showGallery} />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/70">
              La vidéo de présentation sera ajoutée prochainement.
            </div>
          )}
        </div>

        {/* Les quatre étapes, en pilules numérotées */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {template.steps.map((label, i) => (
            <div
              key={label}
              className="sf-reveal"
              style={{ ["--d" as string]: `${320 + i * 70}ms` }}
            >
              <div
                className="sf-float flex items-center gap-2.5 rounded-full bg-secondary/70 px-4 py-3"
                style={{ ["--f" as string]: `${i * 0.45}s` }}
              >
                <span className="text-[13px] font-bold" style={{ color: ACCENT }}>
                  0{i + 1}
                </span>
                <span className="text-[13px] font-semibold leading-tight">{label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Résultats : texte et captures côte à côte */}


        {revenue && revenue.images.length === 0 && (
          <section className="mt-6">
            <h3 className="text-[18px] font-bold tracking-tight">Revenus générés</h3>
            <p className="mt-2 text-sm text-muted-foreground">Les revenus seront ajoutés prochainement.</p>
          </section>
        )}
        {revenue && revenue.images.length > 0 && (
          <section className="sf-reveal mt-6" style={{ ["--d" as string]: "560ms" }}>
            <h3 className="text-[18px] font-bold tracking-tight">Revenus générés</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">Des revenus réellement générés avec la monétisation de vidéos IA.</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
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
          className="sf-reveal motion-apple-tap mt-5 mb-4 flex w-full items-center justify-center gap-3 rounded-full bg-foreground py-4 text-[16px] font-semibold text-background shadow-lg"
          style={{ ["--d" as string]: "700ms" }}
        >
          {template.cta}
          <span aria-hidden>→</span>
        </button>
      </div>

      {/* Galerie plein écran : toutes les vidéos générées et approuvées */}
      {showGallery && (
        <div className="fixed inset-0 z-[110] flex flex-col overflow-hidden bg-background">
          <div className="z-10 flex items-center justify-between border-b border-border bg-background px-4 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]">
            <h2 className="text-[15px] font-bold">Galerie des créations</h2>
            <button
              type="button"
              onClick={() => {
                playClick();
                onGo(template.target);
              }}
              className="motion-apple-tap rounded-full bg-foreground px-3.5 py-1.5 text-[13px] font-semibold text-background"
            >
              Quitter
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-28 pt-2 [overscroll-behavior:contain]">
            {gallery === null ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Chargement…</p>
            ) : gallery.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Aucune création publiée pour le moment.</p>
            ) : (
              <>
              <div className="sf-reveal px-2 pb-3 pt-1 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: ACCENT }}>Créations de la communauté</p>
                <h3 className="mt-1 text-[15px] font-bold leading-tight">Vidéos générées avec Sam Flash 2.0</h3>
                <p className="mt-1 text-[12px] text-muted-foreground">Créées par nos utilisateurs déjà inscrits.</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {(galleryAll ? gallery : gallery.slice(0, 6)).map((g, i) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      playClick();
                      setPlaying(g);
                    }}
                    className="sf-reveal motion-apple-tap relative overflow-hidden rounded-2xl bg-black text-left [contain:layout_paint]"
                    style={{ ["--d" as string]: `${Math.min(i, 5) * 60}ms` }}
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

          <div className="fixed inset-x-0 bottom-0 z-[125] border-t border-border bg-background p-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
            <button type="button" onClick={() => { playClick(); onGo(template.target); }} className="w-full rounded-full bg-foreground py-3.5 text-[15px] font-semibold text-background">
              Quitter la galerie
            </button>
          </div>

          {/* Lecteur au clic */}
          {playing && (
            <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/90 p-4" onClick={() => setPlaying(null)}>
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
