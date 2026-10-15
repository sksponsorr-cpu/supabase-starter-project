import { ArrowDown } from "lucide-react";

/**
 * Pastille d'offre flottante, centrée en bas de l'écran.
 * Un anneau pulse autour d'un disque dégradé ; un clic fait défiler jusqu'à la section #tarifs.
 * Affichée ou masquée depuis le bureau d'administrateur (page d'accueil > bandeau d'offre).
 * Les animations sont désactivées si l'utilisateur réduit les animations.
 */
export function OffersTopBanner({ text = "Offre de lancement : voir les abonnements" }: { text?: string }) {
  const goToOffers = () => {
    document.getElementById("tarifs")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <style>{`
        @keyframes ob-ring {
          0% { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes ob-pop {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        .ob-ring { animation: ob-ring 1.6s cubic-bezier(0.16, 1, 0.3, 1) infinite; }
        .ob-pop { animation: ob-pop 1.6s cubic-bezier(0.34, 1.56, 0.64, 1) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ob-ring, .ob-pop { animation: none; }
        }
      `}</style>
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
        <button
          type="button"
          onClick={goToOffers}
          aria-label={text}
          className="pointer-events-auto relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 via-violet-600 to-orange-500 text-white shadow-[0_18px_40px_-12px_rgba(99,102,241,0.7)]"
        >
          <span className="ob-ring absolute inset-0 rounded-full bg-violet-500/60" aria-hidden="true" />
          <span className="ob-pop relative flex flex-col items-center leading-none">
            <span className="text-[11px] font-extrabold uppercase tracking-wider">Offre</span>
            <ArrowDown className="mt-1 h-4 w-4" aria-hidden="true" />
          </span>
        </button>
      </div>
    </>
  );
}
