import { creditCostFor, type CreditConfig } from "@/lib/credits";

/** Ligne d'offre (sous-ensemble de product_prices) utilisée pour les crédits inclus. */
export type PlanCreditRow = {
  id: string;
  amount_eur: number;
  amount_eur_yearly: number | null;
  credits_rate: number | null;
  credits_bonus: number;
  credits_fixed: number | null;
};

/** Crédits inclus par mois. Source unique pour l'accueil et la fiche des offres. */
export function includedCredits(p: PlanCreditRow, yearly: boolean): number {
  if (p.id === "custom") return 110;
  if (p.credits_fixed !== null) return Math.round(p.credits_fixed);
  const base = yearly && p.amount_eur_yearly !== null ? p.amount_eur_yearly / 12 : p.amount_eur;
  return Math.round(base * (p.credits_rate ?? 0)) + Math.round(p.credits_bonus ?? 0);
}

/** Nombre de vidéos de 5 s en 480p que permet un total de crédits, avec les coûts réels. */
export function videosFor(credits: number, cfg: CreditConfig): number {
  return Math.floor(credits / creditCostFor("video", 5, "480p", cfg));
}
