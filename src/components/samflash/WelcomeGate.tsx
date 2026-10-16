import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { getWelcomeGate } from "@/lib/welcome-gate.functions";
import { ReferenceShowcase } from "@/components/samflash/ReferenceShowcase";
import { playClick } from "@/lib/chime";
import logoAsset from "@/assets/vizuely-logo.png";

const DISMISS_KEY = "sf-welcome-dismissed";
const CHOICE_KEY = "sf-parcours";

export type Parcours = "generation" | "clonage";

/** Lit le choix du parcours de la session en cours (null si aucun). */
export function getSessionParcours(): Parcours | null {
  try {
    const v = window.sessionStorage.getItem(CHOICE_KEY);
    return v === "generation" || v === "clonage" ? v : null;
  } catch {
    return null;
  }
}

/** Accueil après connexion : message de bienvenue, puis choix du parcours. Une fois par session. */
export function WelcomeGate() {
  const fetchGate = useServerFn(getWelcomeGate);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [choice, setChoice] = useState<Parcours | null>(null);

  useEffect(() => {
    let alive = true;
    try {
      if (window.sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignoré */
    }
    fetchGate()
      .then((r) => alive && setOpen(r.show))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [fetchGate]);

  if (!open) return null;

  const finish = (choice: Parcours | null) => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
      if (choice) window.sessionStorage.setItem(CHOICE_KEY, choice);
    } catch {
      /* stockage indisponible : on ferme quand même */
    }
    setOpen(false);
  };

  /** Quitte l'accueil et ouvre directement le modèle choisi. */
  const goTo = (path: "/app" | "/clonage-video") => {
    finish(choice);
    void navigate({ to: path });
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex justify-center overflow-y-auto p-5 ${
        step === 3 ? "items-start bg-background" : "items-center bg-background/90 backdrop-blur-xl"
      }`}
    >
      <div key={step} className={`w-full max-w-md ${step === 3 ? "" : "motion-apple text-center"}`}>
        {step === 1 ? (
          <>
            <img src={logoAsset} alt="Logo" className="motion-apple mx-auto mb-8 h-20 w-20 object-contain" style={{ animationDelay: "0ms" }} />
            <p className="motion-apple text-xs font-semibold uppercase tracking-[0.25em] text-primary" style={{ animationDelay: "80ms" }}>
              Sam Flash 2.0
            </p>
            <h1 className="motion-apple mt-3 text-3xl font-semibold tracking-tight sm:text-4xl" style={{ animationDelay: "140ms" }}>
              Bienvenue sur Sam Flash 2.0
            </h1>
            <p className="motion-apple mx-auto mt-4 max-w-sm text-base leading-relaxed text-muted-foreground" style={{ animationDelay: "200ms" }}>
              Créez des vidéos et des images professionnelles en quelques minutes, avec la puissance de l'IA.
            </p>
            <button
              type="button"
              onClick={() => {
                playClick();
                setStep(2);
              }}
              className="motion-apple motion-apple-tap mt-10 w-full rounded-full bg-foreground py-4 text-base font-semibold text-background shadow-lg"
              style={{ animationDelay: "280ms" }}
            >
              Continuer
            </button>
          </>
        ) : step === 3 && choice ? (
          <ReferenceShowcase parcours={choice} onGo={goTo} />
        ) : (
          <>
            <p className="motion-apple text-xs font-semibold uppercase tracking-[0.25em] text-primary">Votre point de départ</p>
            <h2 className="motion-apple mt-3 text-2xl font-semibold tracking-tight sm:text-3xl" style={{ animationDelay: "60ms" }}>
              Que voulez-vous créer aujourd'hui ?
            </h2>

            <div className="mt-8 space-y-3 text-left">
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setChoice("generation");
                  setStep(3);
                }}
                className="motion-apple motion-apple-tap flex w-full items-start gap-4 rounded-3xl border border-border bg-card/60 p-5 transition hover:border-primary"
                style={{ animationDelay: "140ms" }}
              >
                <span className="text-2xl">🎬</span>
                <span>
                  <span className="block text-base font-semibold">Génération de vidéos</span>
                  <span className="mt-1 block text-sm text-muted-foreground">Décrivez votre idée, nous la transformons en vidéo.</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playClick();
                  setChoice("clonage");
                  setStep(3);
                }}
                className="motion-apple motion-apple-tap flex w-full items-start gap-4 rounded-3xl border border-border bg-card/60 p-5 transition hover:border-primary"
                style={{ animationDelay: "210ms" }}
              >
                <span className="text-2xl">🧬</span>
                <span>
                  <span className="block text-base font-semibold">Clonage vidéo</span>
                  <span className="mt-1 block text-sm text-muted-foreground">Reproduisez un mouvement ou une gestuelle à partir d'une vidéo de référence.</span>
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                playClick();
                finish(null);
              }}
              className="motion-apple mt-6 text-sm text-muted-foreground underline-offset-4 hover:underline"
              style={{ animationDelay: "280ms" }}
            >
              Passer pour l'instant
            </button>
          </>
        )}
      </div>
    </div>
  );
}
