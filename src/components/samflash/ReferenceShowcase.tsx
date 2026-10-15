/**
 * Vitrine de la vidéo de référence (étape 3 du parcours).
 * Modifiable ici : la vidéo, les captures et les avantages.
 * La vidéo et les captures seront ajoutées depuis le bureau d'administrateur plus tard.
 */

export const REFERENCE_VIDEO_URL = ""; // ex. "https://…/video-reference.mp4" (vide = affichage de remplacement)
export const REFERENCE_CAPTURES: string[] = []; // captures de monétisation, ajoutées depuis l'administration

export const REFERENCE_BADGE = "Créée à 100 % avec Sam Flash 2.0";

export const AVANTAGES = [
  {
    titre: "Sans compétence technique",
    texte: "Décrivez votre idée en français, Sam Flash s'occupe du reste.",
  },
  {
    titre: "De 5 secondes à 10 minutes",
    texte: "Des vidéos courtes pour les réseaux, ou des formats plus longs à partir d'une seule demande.",
  },
  {
    titre: "Clonage vidéo",
    texte: "Reproduisez une gestuelle ou un mouvement à partir d'une vidéo de référence.",
  },
  {
    titre: "Images et vidéos au même endroit",
    texte: "Créez vos visuels et vos vidéos sans logiciel de montage.",
  },
  {
    titre: "Prêt pour vos réseaux",
    texte: "Publiez vos contenus sur TikTok, YouTube ou Instagram, selon les règles de chaque plateforme.",
  },
  {
    titre: "Paiement local",
    texte: "Payez par Mobile Money, sans carte bancaire.",
  },
];

type Props = { onContinue: () => void };

export function ReferenceShowcase({ onContinue }: Props) {
  return (
    <div className="motion-enter w-full max-w-md text-left">
      <div className="relative aspect-[9/12] w-full overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500/30 via-indigo-500/20 to-black shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)]">
        {REFERENCE_VIDEO_URL ? (
          <video src={REFERENCE_VIDEO_URL} className="h-full w-full object-cover" autoPlay loop muted playsInline />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/70">
            Vidéo de référence à venir
          </div>
        )}
        <span className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
          {REFERENCE_BADGE}
        </span>
      </div>

      <h2 className="mt-6 text-2xl font-semibold tracking-tight">Ce que vous pouvez créer</h2>

      <ul className="mt-4 space-y-3">
        {AVANTAGES.map((a, i) => (
          <li
            key={a.titre}
            className="motion-enter rounded-2xl border border-border bg-card/60 p-4"
            style={{ animationDelay: `${80 + i * 60}ms` }}
          >
            <p className="text-sm font-semibold">{a.titre}</p>
            <p className="mt-1 text-sm text-muted-foreground">{a.texte}</p>
          </li>
        ))}
      </ul>

      {REFERENCE_CAPTURES.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3">
          {REFERENCE_CAPTURES.map((src) => (
            <img key={src} src={src} alt="" className="w-full rounded-2xl border border-border" loading="lazy" />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onContinue}
        className="motion-press mt-8 w-full rounded-full bg-foreground py-4 text-base font-semibold text-background shadow-lg"
      >
        Commencer ma vidéo
      </button>
    </div>
  );
}
