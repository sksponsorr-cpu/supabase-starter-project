import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PartnerGate } from "@/components/samflash/PartnerApplicationForm";
import { PARTNER_COMMISSION_PERCENT, MIN_WITHDRAWAL_USD } from "@/lib/partner-config";

export const Route = createFileRoute("/partenaires")({
  component: PartenairesPage,
});

const glass = "rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-2xl";
const pill = "inline-flex items-center justify-center rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_10px_40px_-10px] shadow-primary/60 transition-all duration-500 ease-out hover:-translate-y-0.5 hover:shadow-primary/80 active:scale-[0.98]";

/** Page publique à partager : présentation du programme et demande d'adhésion. */
function PartenairesPage() {
  const { session, loading } = useAuth();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const reveal = (delay: number) =>
    `transition-all duration-700 ease-out ${shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`;

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      {/* Halos flous en arrière-plan */}
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/25 blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute top-[38%] -left-24 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-[100px]" />
      <div aria-hidden className="pointer-events-none absolute bottom-0 right-[-80px] h-80 w-80 rounded-full bg-cyan-400/15 blur-[110px]" />

      <div className="relative mx-auto max-w-xl space-y-6 px-5 py-14">
        <header className={`text-center ${reveal(0)}`}>
          <span className="inline-block rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground backdrop-blur-xl">
            Programme partenaires
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight">
            Gagnez{" "}
            <span className="bg-gradient-to-r from-primary via-sky-300 to-fuchsia-300 bg-clip-text text-transparent">
              {PARTNER_COMMISSION_PERCENT} %
            </span>{" "}
            en faisant découvrir Sam Flash
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">
            Partagez votre code. Chaque personne qui s'inscrit et achète vous rapporte une commission.
          </p>
        </header>

        <section className={`grid grid-cols-3 gap-3 ${reveal(100)}`}>
          {[
            { value: `${PARTNER_COMMISSION_PERCENT} %`, label: "du premier paiement" },
            { value: `${MIN_WITHDRAWAL_USD} $`, label: "retrait minimum" },
            { value: "Local", label: "monnaie de votre pays" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center backdrop-blur-2xl">
              <p className="text-xl font-semibold tabular-nums">{s.value}</p>
              <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </section>

        <section className={`${glass} ${reveal(200)}`}>
          <ul className="space-y-4 text-sm">
            <li className="flex gap-3">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span className="text-muted-foreground">Votre lien et votre code personnels, avec le suivi de vos inscriptions et de vos ventes.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-300" />
              <span className="text-muted-foreground">Retrait par Mobile Money ou virement, dans la monnaie de votre pays.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-300" />
              <span className="text-muted-foreground">Aucun frais pour rejoindre. Vous êtes payé sur les ventes réelles, sans promesse de gains.</span>
            </li>
          </ul>
        </section>

        <div className={reveal(300)}>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Chargement…</p>
          ) : session ? (
            <PartnerGate>
              <div className={`${glass} text-center`}>
                <p className="text-base font-semibold">Votre demande est approuvée</p>
                <p className="mt-1 text-sm text-muted-foreground">Retrouvez votre lien et vos commissions dans votre espace.</p>
                <Link to="/parrainage" className={`${pill} mt-6`}>Ouvrir mon espace partenaire</Link>
              </div>
            </PartnerGate>
          ) : (
            <div className={`${glass} space-y-5 text-center`}>
              <p className="text-sm text-muted-foreground">Connectez-vous ou créez votre compte pour envoyer votre demande.</p>
              <Link to="/connexion" search={{ next: "/partenaires" }} className={pill}>
                Se connecter pour postuler
              </Link>
            </div>
          )}
        </div>

        <footer className={`pt-2 text-center text-xs text-muted-foreground ${reveal(400)}`}>
          <Link to="/conditions-partenaires" className="underline underline-offset-4 hover:text-foreground">
            Conditions du programme
          </Link>
        </footer>
      </div>
    </main>
  );
}
