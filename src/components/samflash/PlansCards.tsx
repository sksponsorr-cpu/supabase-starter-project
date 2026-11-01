import { Check } from "lucide-react";

/**
 * Les offres affichées côte à côte, toutes visibles en même temps.
 * Chaque carte mène à la même suite : sélection puis paiement.
 * Les textes (prix, crédits) viennent du parent, qui connaît le pays et la devise.
 */

export type PlanCardData = {
  id: string;
  name: string;
  /** Ex. « 7 900 FCFA / mois » — déjà formaté dans la devise du pays. */
  priceLabel: string;
  /** Ex. « 150 crédits + 50 offerts chaque mois ». */
  creditsLabel: string;
  /** Liste courte de ce que l'offre permet, une ligne par point. */
  features: string[];
  /** Vrai pour l'offre à mettre en avant. */
  highlighted?: boolean;
  /** Texte du bouton, par défaut « Choisir cette offre ». */
  cta?: string;
};

export function PlansCards({
  plans,
  selectedId,
  onSelect,
}: {
  plans: PlanCardData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {plans.map((plan) => {
        const selected = selectedId === plan.id;
        return (
          <article
            key={plan.id}
            className={`relative flex flex-col rounded-3xl border p-5 transition-colors ${
              selected
                ? "border-primary bg-primary/10"
                : plan.highlighted
                  ? "border-primary/60 bg-white/[0.06]"
                  : "border-white/10 bg-white/[0.04]"
            }`}
          >
            {plan.highlighted && (
              <span className="absolute -top-3 left-5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                Le plus choisi
              </span>
            )}

            <h3 className="text-lg font-bold">{plan.name}</h3>
            <p className="mt-2 text-2xl font-extrabold">{plan.priceLabel}</p>
            <p className="mt-1 text-sm text-muted-foreground">{plan.creditsLabel}</p>

            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => onSelect(plan.id)}
              className={`mt-5 w-full rounded-full px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90 ${
                selected || plan.highlighted
                  ? "bg-primary text-primary-foreground"
                  : "border border-white/20 text-foreground"
              }`}
            >
              {selected ? "Offre sélectionnée" : plan.cta ?? "Choisir cette offre"}
            </button>
          </article>
        );
      })}
    </div>
  );
}
