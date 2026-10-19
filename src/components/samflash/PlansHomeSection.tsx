import { Link } from "@tanstack/react-router";
import { PLANS, monthlyCreditsFor, formatFcfa, type Plan } from "@/lib/pricing-fcfa";
import { samCreditsFor, type PricedModel, type PricedResolution, type VeoTier } from "@/lib/creator-pricing";

/** Vidéos affichées par modèle : une seule configuration de référence par modèle, sans durée affichée. */
const SHOWCASE: { label: string; model: PricedModel; resolution: PricedResolution; seconds: number; tier?: VeoTier }[] = [
  { label: "Grok Imagine", model: "grok-imagine", resolution: "480p", seconds: 6 },
  { label: "Seedance 2.0", model: "seedance-2", resolution: "480p", seconds: 5 },
  { label: "Seedance 2.5", model: "seedance-2-5", resolution: "480p", seconds: 5 },
  { label: "Veo 3.1", model: "veo-3-1", resolution: "720p", seconds: 8, tier: "fast" },
];

/** Nombre de vidéos possibles avec le total de crédits du plan. */
function videosFor(plan: Plan, item: (typeof SHOWCASE)[number]): number {
  const cost = samCreditsFor(item.model, item.resolution, item.seconds, item.tier ?? "fast");
  if (!cost) return 0;
  return Math.floor(monthlyCreditsFor(plan) / cost);
}

export function PlansHomeSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Abonnements</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Créez chaque mois, sans compter</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Un abonnement, tous les modèles vidéo. Choisissez le plan qui correspond à votre rythme.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {PLANS.map((plan) => {
          const isPro = plan.id === "pro";
          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-3xl border p-8 transition ${
                isPro ? "border-primary bg-card shadow-xl ring-1 ring-primary/30" : "border-border bg-card shadow-sm"
              }`}
            >
              {isPro && (
                <span className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Le plus choisi
                </span>
              )}

              <h3 className="text-xl font-semibold">Sam Flash {plan.label}</h3>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-bold">{formatFcfa(plan.priceFcfa)}</span>
                <span className="text-sm text-muted-foreground">/ mois</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">soit {plan.priceEur} € par mois</p>

              <div className="mt-6 rounded-2xl bg-muted/60 p-4">
                <p className="text-sm font-medium">{monthlyCreditsFor(plan)} crédits chaque mois</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  dont {monthlyCreditsFor(plan) - plan.baseCredits} crédits de bonus offerts
                </p>
              </div>

              <ul className="mt-6 space-y-3">
                {SHOWCASE.map((item) => (
                  <li key={item.model} className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-right text-muted-foreground">
                      jusqu'à <span className="font-semibold text-foreground">{videosFor(plan, item)}</span> vidéos · {item.resolution}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                to="/app"
                className={`mt-8 inline-flex h-12 items-center justify-center rounded-full text-sm font-semibold transition ${
                  isPro
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "border border-border bg-background hover:bg-muted"
                }`}
              >
                Choisir Sam Flash {plan.label}
              </Link>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Les nombres de vidéos sont indicatifs et dépendent du modèle et de la résolution choisis.
      </p>
    </section>
  );
}
