import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/conditions-partenaires")({
  component: ConditionsPartenaires,
});

/** Conditions du programme partenaires Sam Flash. À faire relire par un juriste avant publication. */
function ConditionsPartenaires() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6 text-sm leading-relaxed">
      <h1 className="text-2xl font-semibold">Conditions du programme partenaires</h1>
      <p className="text-muted-foreground">Dernière mise à jour : [date]</p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">1. Objet</h2>
        <p>Le programme partenaires permet à une personne approuvée de toucher une commission sur les abonnements et packs achetés par les personnes qui s'inscrivent avec son code personnel.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">2. Conditions d'adhésion</h2>
        <p>Chaque demande est examinée par Sam Flash. Sam Flash peut approuver ou refuser une demande sans avoir à en donner la raison. Une seule demande est autorisée par compte.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">3. Commission</h2>
        <p>Le partenaire approuvé reçoit 25 % du montant payé par le filleul pour son premier achat. Une commission n'est enregistrée qu'une seule fois par commande. Les achats suivants ne donnent pas droit à commission.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">4. Retrait</h2>
        <p>Le retrait est possible dès que le solde disponible atteint l'équivalent de 5 $ dans la monnaie du pays choisi par le partenaire, au taux de change du moment. Le partenaire choisit son mode de paiement (Mobile Money ou virement). Les paiements sont effectués après vérification de la demande.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">5. Remboursements et annulations</h2>
        <p>Si un achat est remboursé ou annulé, la commission correspondante n'est pas versée. Si elle a déjà été versée, Sam Flash peut la déduire des commissions suivantes.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">6. Règles de communication</h2>
        <p>Le partenaire ne doit pas promettre de gains, de résultats ni de rendement. Il doit signaler toute publication sponsorisée (#sponsorisé ou #publicité). Il ne doit pas utiliser de photos ou de contenus de tiers sans leur accord, ni envoyer de messages non sollicités.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">7. Suspension</h2>
        <p>Sam Flash peut suspendre ou retirer l'adhésion d'un partenaire qui ne respecte pas ces conditions, notamment en cas de fraude, de faux comptes ou d'auto-parrainage. Les commissions déjà acquises à la date de suspension restent dues, sauf fraude avérée.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">8. Données personnelles</h2>
        <p>Les informations fournies (nom, e-mail, téléphone, pays) servent uniquement à gérer le programme et les paiements. Pour exercer vos droits, contactez Sam Flash à l'adresse indiquée dans les mentions légales.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">9. Modification</h2>
        <p>Sam Flash peut modifier ces conditions. Les partenaires en sont informés dans leur espace.</p>
      </section>
    </main>
  );
}
