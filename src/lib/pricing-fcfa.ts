/**
 * Prix affichés en francs CFA (montant principal). Données seulement, sans secret.
 * Base : 1 € = 655,957 FCFA (parité fixe). Montants arrondis à 100 FCFA.
 * 1 crédit Sam Flash = 0,09 € = environ 59 FCFA.
 * Bonus de premier achat : +50 crédits, une seule fois par compte.
 */

export const EUR_TO_FCFA = 655.957;
export const FIRST_PURCHASE_BONUS_CREDITS = 50;

export type CreditPack = {
  id: "essai" | "starter" | "createur" | "pro";
  label: string;
  credits: number;
  priceFcfa: number;
  priceEur: number; // montant de référence, affiché en petit
};

export const CREDIT_PACKS: CreditPack[] = [
  { id: "essai", label: "Essai", credits: 100, priceEur: 9, priceFcfa: 5900 },
  { id: "starter", label: "Starter", credits: 300, priceEur: 25, priceFcfa: 16400 },
  { id: "createur", label: "Créateur", credits: 1000, priceEur: 80, priceFcfa: 52500 },
  { id: "pro", label: "Pro", credits: 3000, priceEur: 225, priceFcfa: 147600 },
];

/** Bonus inclus sur chaque abonnement, en plus des crédits du plan. */
export const PLAN_BONUS_CREDITS = 50;

export type Plan = {
  id: "light" | "pro";
  label: string;
  baseCredits: number; // crédits du plan, avant le bonus
  priceEur: number;
  priceFcfa: number;
  models: string[]; // modèles inclus
};

export const PLAN_MODELS = [
  "Grok Imagine",
  "Seedance 2.0",
  "Seedance 2.5",
  "Veo 3.1",
  "Google Omni",
];

export const PLANS: Plan[] = [
  { id: "light", label: "Light", baseCredits: 150, priceEur: 12, priceFcfa: 7900, models: PLAN_MODELS },
  { id: "pro", label: "Pro", baseCredits: 400, priceEur: 29, priceFcfa: 19000, models: PLAN_MODELS },
];

/** Crédits réellement reçus chaque mois, bonus compris. */
export function monthlyCreditsFor(plan: Plan): number {
  return plan.baseCredits + PLAN_BONUS_CREDITS;
}

/** Crédits reçus pour un pack, avec le bonus si c'est le premier achat. */
export function creditsForPack(pack: CreditPack, isFirstPurchase: boolean): number {
  return pack.credits + (isFirstPurchase ? FIRST_PURCHASE_BONUS_CREDITS : 0);
}

/** Affichage : « 5 900 FCFA ». */
export function formatFcfa(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}
