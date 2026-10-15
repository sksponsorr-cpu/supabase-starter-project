/**
 * Parcours après le choix : une seule suite de pages.
 * 1. Accueil du parcours : vidéo de présentation, titre, avantages, étapes, résultats.
 * 2. Bouton « Continuer » : galerie de la communauté (titre en haut, bouton en bas).
 * 3. Bouton final : ouvre directement le modèle choisi.
 * Contenu (vidéos, captures, revenus) géré depuis le bureau d'administrateur.
 */
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
  advantages: [string, string, string];
  steps: [string, string, string, string];
  resultsTitle: string;
  resultsText: string;
  galleryTitle: string;
  galleryText: string;
  cta: string;
  target: "/app" | "/clonage-video";
};

/** Contenu de chaque parcours. */
export const TEMPLATES: Record<Parcours, Template> = {
  generation: {
    category: "pub",
    eyebrow: "Témoignage vidéo",
    title: "Une vraie personne présente votre produit en vidéo.",
    text: "Décrivez votre idée et obtenez une vidéo prête à publier sur vos réseaux sociaux, sans caméra ni acteur.",
    advantages: [
      "Vidéo prête en quelques minutes",
      "Aucun matériel ni tournage nécessaire",
      "5 crédits offerts pour créer vos premières images",
    ],
    steps: ["La personne", "Votre produit", "L'image", "Texte et montage"],
    resultsTitle: "Résultats de nos utilisateurs",
    resultsText: "Captures des revenus obtenus avec des vidéos créées sur Sam flash 2.0.",
    galleryTitle: "Créations de la communauté",
    galleryText: "Vidéos et images déjà créées avec Sam flash 2.0 par nos utilisateurs inscrits.",
    cta: "Commencer ma vidéo",
    target: "/app",
  },
  clonage: {
    category: "clone",
    eyebrow: "Clonage vidéo",
    title: "Reproduisez un mouvement à partir d'une vidéo.",
    text: "Partez d'une vidéo de référence : la gestuelle est reproduite sur la personne de votre choix.",
    advantages: [
      "Reproduction fidèle du mouvement",
      "Choisissez la personne qui le joue",
      "Résultat en quelques minutes",
    ],
    steps: ["Vidéo de référence", "Le mouvement", "La personne", "Le résultat"],
    resultsTitle: "Résultats de nos utilisateurs",
    resultsText: "Clonages réalisés avec Sam flash 2.0 à partir de vraies vidéos de référence.",
    galleryTitle: "Créations de la communauté",
    galleryText: "Clonages et images déjà créés avec Sam flash 2.0 par nos utilisateurs inscrits.",
    cta: "Commencer mon clonage",
    target: "/clonage-video",
  },
};

/** Nombre d'éléments affichés d'un coup dans la galerie (évite une page trop lourde). */
const GALLERY_PAGE = 12;

const ACCENT = "var(--sf-accent, #6d28d9)";

const isVideo = (url: string) => /\.(mp4|webm|mov)(\?|#|$)/i.test(url);

type Props = {
  parcours: Parcours;
  /** Appelé avec la page de destination (le modèle choisi). */
  onGo: (path: "/app" | "/clonage-video") => void;
};

/** Lecteur du haut de page : enchaîne les vidéos (et images) du parcours, en boucle. */
function ShowcasePlayer({ items }: { items: ShowcaseItem[] }) {
  const [idx, setIdx] = useState(0);
  const count = items.length;
  const current = count > 0 ? items[idx % count] : null;

  const next = () => setIdx((i) => (count > 0 ? (i + 1) % count : 0));

  // Les images ne déclenchent pas « fin de lecture » : on change toutes les 5 secondes.
  useEffect(() => {
    if (!current || isVideo(current.url) || count < 2) return;
    const t = window.setTimeout(next, 5000);
    return () => window.clearTimeout(t);
  }, [idx, count, current]);

  if (!current) {
    return (
      <div className="relative flex aspect-[9/12] w-full items-center justify-center overflow-hidden rounded-[28px] bg-black p-6 text-center text-sm text-white/70 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)]">
        La vidéo de présentation sera ajoutée prochainement.
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-[9/12] w-full overflow-hidden rounded-[28px] bg-black shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)]">
        {isVideo(current.url) ? (
          <video
            key={current.url}
            src={current.url}
            className="h-full w-full object-contain"
            autoPlay
            muted
            playsInline
            onEnded={next}
            onError={next}
            // Une seule vidéo : elle se répète seule.
            loop={count < 2}
          />
        ) : (
          <img key={current.url} src={current.url} alt={current.caption} className="h-full w-full object-contain" />
        )}
      </div>
      {count > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {items.map((it, i) => (
            <button
              key={it.url}
              type="button"
              aria-label={`Vidéo ${i + 1}`}
              onClick={() => setIdx(i)}
              className="h-2 rounded-full transition-all"
              style={{ width: i === idx % count ? 20 : 8, background: i === idx % count ? ACCENT : "#cbd5e1" }}
            />
          ))}
        </div>
      )}
      {current.caption && <p className="mt-2 text-center text-xs text-muted-foreground">{current.caption}</p>}
    </div>
  );
}

export function ReferenceShowcase({ parcours, onGo }: Props) {
  const template = TEMPLATES[parcours];
  const fetchLanding = useServerFn(getLanding);
  const fetchGallery = useServerFn(listCommunityGallery);
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [view, setView] = useState<"intro" | "gallery">("intro");
  const [gallery, setGallery] = useState<CommunityItem[] | null>(null);
  const [shown, setShown] = useState(GALLERY_PAGE);

  useEffect(() => {
    let alive = true;
    fetchLanding()
      .then((d) => {
        if (alive) setItems((d.showcase ?? []).filter((v) => v.cat === template.category));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [fetchLanding, template.category]);

  // Charge la galerie uniquement quand l'utilisateur arrive dessus.
  useEffect(() => {
    if (view !== "gallery" || gallery !== null) return;
    let alive = true;
    fetchGallery({})
      .then((rows) => alive && setGallery(rows as CommunityItem[]))
      .catch(() => alive && setGallery([]));
    return () => {
      alive = false;
    };
  }, [view, gallery, fetchGallery]);

  const main = items[0];
  const results = items.slice(1);

  const goGallery = () => {
    playClick();
    setView("gallery");
    window.scrollTo({ top: 0 });
  };

  const leave = () => {
    playClick();
    onGo(template.target);
  };

  if (view === "gallery") {
    const list = gallery ?? [];
    const visible = list.slice(0, shown);
    return (
      <div className="w-full max-w-md text-left">
        <p className="text-[13px] font-semibold uppercase tracking-[0.2em]" style={{ color: ACCENT }}>
          Galerie
        </p>
        <h2 className="mt-2 text-[26px] font-extrabold leading-tight tracking-tight">{template.galleryTitle}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{template.galleryText}</p>

        {gallery === null ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Chargement…</p>
        ) : list.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Aucune création publiée pour le moment.</p>
        ) : (
          <>
            <p className="mt-5 text-xs text-muted-foreground">
              {list.length} création{list.length > 1 ? "s" : ""} publiée{list.length > 1 ? "s" : ""}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {visible.map((g) => (
                <figure key={g.id} className="overflow-hidden rounded-2xl bg-muted">
                  {g.media_url && g.media_type === "video" ? (
                    <video
                      src={g.media_url}
                      preload="none"
                      muted
                      loop
                      playsInline
                      controls
                      className="aspect-[9/12] w-full bg-black object-cover"
                    />
                  ) : g.media_url ? (
                    <img
                      src={g.media_url}
                      alt={g.prompt}
                      loading="lazy"
                      decoding="async"
                      className="aspect-[9/12] w-full object-cover"
                    />
                  ) : null}
                </figure>
              ))}
            </div>
            {shown < list.length && (
              <button
                type="button"
                onClick={() => setShown((n) => n + GALLERY_PAGE)}
                className="motion-apple-tap mt-4 w-full rounded-full border border-border py-3 text-sm font-semibold"
              >
                Voir plus de créations
              </button>
            )}
          </>
        )}

        {/* Bas de page : sortie vers le modèle choisi */}
        <button
          type="button"
          onClick={leave}
          className="motion-apple-tap mt-8 flex w-full items-center justify-center gap-3 rounded-full bg-foreground py-5 text-[17px] font-semibold text-background shadow-lg"
        >
          {template.cta}
          <span aria-hidden>→</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md text-left">
      {/* Lecteur en haut de page : toutes les vidéos de ce parcours, qui s'enchaînent */}
      <ShowcasePlayer items={items} />

      <p className="mt-8 text-[13px] font-semibold uppercase tracking-[0.2em]" style={{ color: ACCENT }}>
        {template.eyebrow}
      </p>
      <h2 className="mt-3 text-[28px] font-extrabold leading-[1.1] tracking-tight">{template.title}</h2>
      <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground">{template.text}</p>

      {/* Avantages */}
      <ul className="mt-6 space-y-2">
        {template.advantages.map((a) => (
          <li key={a} className="flex items-start gap-2 text-[15px] font-medium">
            <span aria-hidden style={{ color: ACCENT }}>✓</span>
            <span>{a}</span>
          </li>
        ))}
      </ul>

      {/* Étapes */}
      <div className="mt-7 grid grid-cols-2 gap-3">
        {template.steps.map((label, i) => (
          <div key={label} className="flex items-center gap-3 rounded-full bg-secondary/70 px-4 py-3">
            <span className="text-[14px] font-bold" style={{ color: ACCENT }}>
              0{i + 1}
            </span>
            <span className="text-[14px] font-semibold leading-tight">{label}</span>
          </div>
        ))}
      </div>

      {/* Résultats : captures et revenus, ajoutés depuis le bureau d'administrateur */}
      <section className="mt-10">
        <h3 className="text-[22px] font-bold tracking-tight">{template.resultsTitle}</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{template.resultsText}</p>
        {results.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {results.map((it) => (
              <figure key={it.url} className="overflow-hidden rounded-2xl bg-muted">
                {isVideo(it.url) ? (
                  <video src={it.url} preload="none" muted loop playsInline className="aspect-[9/12] w-full object-cover" />
                ) : (
                  <img src={it.url} alt={it.caption} loading="lazy" decoding="async" className="aspect-[9/12] w-full object-cover" />
                )}
                {it.caption && <figcaption className="bg-background px-3 py-2 text-xs text-muted-foreground">{it.caption}</figcaption>}
              </figure>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Les captures de résultats seront ajoutées prochainement.
          </p>
        )}
      </section>

      {/* Passage à la galerie */}
      <button
        type="button"
        onClick={goGallery}
        className="motion-apple-tap mt-8 flex w-full items-center justify-center gap-3 rounded-full bg-foreground py-5 text-[17px] font-semibold text-background shadow-lg"
      >
        Continuer
        <span aria-hidden>→</span>
      </button>
    </div>
  );
}
