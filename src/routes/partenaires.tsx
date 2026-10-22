import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { PartnerGate } from "@/components/samflash/PartnerApplicationForm";
import { PARTNER_COMMISSION_PERCENT, MIN_WITHDRAWAL_USD } from "@/lib/partner-config";

export const Route = createFileRoute("/partenaires")({
  component: PartenairesPage,
});

const card = "rounded-3xl border border-white/10 bg-card/60 p-5 backdrop-blur-xl";
const pill = "inline-block rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all duration-500 ease-out hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]";

/** Page publique à partager : présentation du programme et demande d'adhésion. */
function PartenairesPage() {
  const { session, loading } = useAuth();

  return (
    <main className="mx-auto max-w-xl space-y-5 p-5">
      <section className={card}>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Programme partenaires Sam Flash</p>
        <h1 className="mt-1 text-2xl font-semibold">Gagnez {PARTNER_COMMISSION_PERCENT} % en faisant découvrir Sam Flash</h1>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          <li>• {PARTNER_COMMISSION_PERCENT} % du premier paiement de chaque personne qui s'inscrit avec votre code.</li>
          <li>• Un lien et un code personnels, avec le suivi de vos inscriptions et de vos ventes.</li>
          <li>• Retrait dès {MIN_WITHDRAWAL_USD} $, dans la monnaie de votre pays, par Mobile Money ou virement.</li>
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Pas de frais pour rejoindre. Pas de promesse de gains : vous êtes payé sur les ventes réelles.
        </p>
      </section>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : session ? (
        <PartnerGate>
          <section className={card}>
            <p className="text-sm font-semibold">Votre demande est approuvée.</p>
            <Link to="/parrainage" className={`${pill} mt-4`}>Ouvrir mon espace partenaire</Link>
          </section>
        </PartnerGate>
      ) : (
        <section className={`${card} space-y-4`}>
          <p className="text-sm">Connectez-vous ou créez votre compte pour envoyer votre demande.</p>
          <Link to="/connexion" search={{ next: "/partenaires" }} className={pill}>
            Se connecter pour postuler
          </Link>
        </section>
      )}
    </main>
  );
}
