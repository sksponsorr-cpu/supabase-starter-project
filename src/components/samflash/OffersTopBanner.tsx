import { ArrowDown } from "lucide-react";

/**
 * Bandeau fixe en haut de la page : il tremble doucement et clignote pour attirer l'œil.
 * Un clic fait défiler jusqu'à la section #tarifs.
 * Les animations sont désactivées si l'utilisateur réduit les animations.
 */
export function OffersTopBanner() {
  const goToOffers = () => {
    document.getElementById("tarifs")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <style>{`
        @keyframes ob-shake {
          0%, 90%, 100% { transform: translateX(0); }
          92% { transform: translateX(-3px); }
          94% { transform: translateX(3px); }
          96% { transform: translateX(-2px); }
          98% { transform: translateX(2px); }
        }
        @keyframes ob-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        .ob-shake { animation: ob-shake 4s ease-in-out infinite; }
        .ob-blink { animation: ob-blink 1.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ob-shake, .ob-blink { animation: none; }
        }
      `}</style>
      <div className="fixed inset-x-0 top-0 z-50 h-9 bg-gradient-to-r from-indigo-600 via-violet-600 to-orange-500 text-white">
        <button
          type="button"
          onClick={goToOffers}
          className="ob-shake flex h-full w-full items-center justify-center gap-2 text-sm font-semibold"
        >
          <span className="ob-blink" aria-hidden="true">●</span>
          Offre de lancement : voir les abonnements
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </>
  );
}
