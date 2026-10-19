import { PLANS, PLAN_MODELS, monthlyCreditsFor, formatFcfa } from "@/lib/pricing-fcfa";

/** Abonnements affichés sur la page d'accueil. Données issues de pricing-fcfa.ts. */
export function PlansHomeSection() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <h2 className="text-center text-2xl font-semibold">Abonnements</h2>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Des crédits chaque mois, utilisables sur tous les modèles vidéo.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {PLANS.map((plan) => (
          <div key={plan.id} className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-baseline justify-between">
              <h3 className="text-lg font-semibold">Sam Flash {plan.label}</h3>
              <span className="text-sm text-muted-foreground">{plan.priceEur} € / mois</span>
            </div>
            <p className="mt-4 text-3xl font-bold">
              {formatFcfa(plan.priceFcfa)}
              <span className="text-sm font-normal text-muted-foreground"> / mois</span>
            </p>
            <p className="mt-2 text-sm">{monthlyCreditsFor(plan)} crédits par mois, bonus compris</p>
            <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
              {PLAN_MODELS.map((m) => (
                <li key={m}>✓ {m}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
