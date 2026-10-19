import { useEffect, useState } from "react";
import { ArrowRight, Clapperboard, ShoppingBag, Sparkles } from "lucide-react";

type Choice = "creator" | "seller";

const STORAGE_KEY = "sam-flash-profile";

const CARDS: {
  id: Choice;
  title: string;
  text: string;
  message: string;
  Icon: typeof Clapperboard;
}[] = [
  {
    id: "creator",
    title: "Créateur de contenu",
    text: "Créez vos vidéos IA avec le modèle de votre choix.",
    message: "Parfait. Choisissez votre modèle et votre type de vidéo ci-dessous.",
    Icon: Clapperboard,
  },
  {
    id: "seller",
    title: "Vendeur ou e-commerçant",
    text: "Présentez vos produits avec des influenceurs IA et des voix off.",
    message: "Parfait. Votre espace vendeur s'affiche ci-dessous.",
    Icon: ShoppingBag,
  },
];

/**
 * Écran d'accueil de /app : deux cartes animées, flèches, puis message après le choix.
 * Le choix est mémorisé dans le navigateur, pour ne pas le reposer à chaque visite.
 */
export function ProfileOnboarding({ onChoose, allowed }: { onChoose: (c: Choice) => void; allowed: Choice[] }) {
  const [selected, setSelected] = useState<Choice | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Choice | null;
      if ((saved === "creator" || saved === "seller") && allowed.includes(saved)) {
        setSelected(saved);
        onChoose(saved);
      }
    } catch {
      /* navigateur sans stockage : on affiche simplement l'écran */
    }
    const t = setTimeout(() => setReady(true), 50);
    return () => clearTimeout(t);
  }, [onChoose, allowed]);

  const pick = (c: Choice) => {
    setSelected(c);
    onChoose(c);
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch {
      /* ignoré */
    }
  };

  const message = CARDS.find((c) => c.id === selected)?.message;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 mb-6">
      <style>{`
        @keyframes sfRise { from { opacity: 0; transform: translateY(14px) scale(.98); } to { opacity: 1; transform: none; } }
        @keyframes sfNudge { 0%,100% { transform: translateX(0); } 50% { transform: translateX(6px); } }
        @keyframes sfGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(255,255,255,.0); } 50% { box-shadow: 0 0 28px 2px rgba(255,255,255,.18); } }
      `}</style>

      <p className="text-center text-xs uppercase tracking-widest text-white/50 mb-4">
        Choisissez votre espace
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.filter((c) => allowed.includes(c.id)).map((c, i) => {
          const active = selected === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => pick(c.id)}
              style={{
                animation: ready ? `sfRise .6s ease ${i * 0.12}s both` : undefined,
                animationName: active ? "sfGlow" : undefined,
                animationDuration: active ? "2.4s" : undefined,
                animationIterationCount: active ? "infinite" : undefined,
              }}
              className={`group text-left rounded-3xl border p-6 transition ${
                active ? "border-white bg-white/10" : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <c.Icon className="h-7 w-7 text-white mb-4" />
              <p className="text-lg font-semibold text-white">{c.title}</p>
              <p className="text-sm text-white/60 mt-1">{c.text}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-white">
                {active ? "Sélectionné" : "Choisir"}
                {!active && (
                  <ArrowRight className="h-4 w-4" style={{ animation: "sfNudge 1.6s ease-in-out infinite" }} />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {message && (
        <div
          style={{ animation: "sfRise .5s ease both" }}
          className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80"
        >
          <Sparkles className="h-4 w-4 shrink-0" />
          {message}
        </div>
      )}
    </div>
  );
}
