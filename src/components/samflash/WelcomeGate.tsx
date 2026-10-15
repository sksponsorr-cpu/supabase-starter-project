import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getWelcomeGate } from "@/lib/welcome-gate.functions";
import { ReferenceShowcase } from "@/components/samflash/ReferenceShowcase";

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-background/90 p-6 backdrop-blur-xl">
      <div key={step} className={`motion-enter w-full max-w-md ${step === 3 ? "" : "text-center"}`}>
        {step === 1 ? (
          <>
            <div className="mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-500 text-2xl shadow-[0_18px_40px_-12px_rgba(59,130,246,0.6)]">
              ⚡
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Sam Flash 2.0</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Bienvenue sur Sam Flash 2.0</h1>
            <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-muted-foreground">
              Créez des vidéos et des images professionnelles en quelques minutes, avec la puissance de l'IA.
            </p>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="motion-press mt-10 w-full rounded-full bg-foreground py-4 text-base font-semibold text-background shadow-lg"
            >
              Continuer
            </button>
          </>
        ) : step === 3 ? (
          <ReferenceShowcase onContinue={() => finish(choice)} />
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Votre point de départ</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Que voulez-vous créer aujourd'hui ?</h2>

            <div className="mt-8 space-y-3 text-left">
              <button
                type="button"
                onClick={() => {
                  setChoice("generation");
                  setStep(3);
                }}
                className="motion-press flex w-full items-start gap-4 rounded-3xl border border-border bg-card/60 p-5 transition hover:border-primary"
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
                  setChoice("clonage");
                  setStep(3);
                }}
                className="motion-press flex w-full items-start gap-4 rounded-3xl border border-border bg-card/60 p-5 transition hover:border-primary"
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
              onClick={() => finish(null)}
              className="mt-6 text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Passer pour l'instant
            </button>
          </>
        )}
      </div>
    </div>
  );
}
