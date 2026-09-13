/**
 * Pays africains pris en charge par SwyChr / AccountPe (18 pays)
 * et devise locale associée. Module client-safe (aucun secret).
 */
export type SupportedCountry = {
  code: string;
  name: string;
  currency: string;
  /** Indicatif téléphonique international, sans le « + ». */
  dial: string;
  /** Devises sans sous-unité : le montant envoyé doit être entier. */
  zeroDecimal: boolean;
};

export const SUPPORTED_COUNTRIES: SupportedCountry[] = [
  { code: "BJ", name: "Bénin", currency: "XOF", dial: "229", zeroDecimal: true },
  { code: "BF", name: "Burkina Faso", currency: "XOF", dial: "226", zeroDecimal: true },
  { code: "CM", name: "Cameroun", currency: "XAF", dial: "237", zeroDecimal: true },
  { code: "CF", name: "République centrafricaine", currency: "XAF", dial: "236", zeroDecimal: true },
  { code: "TD", name: "Tchad", currency: "XAF", dial: "235", zeroDecimal: true },
  { code: "CG", name: "Congo-Brazzaville", currency: "XAF", dial: "242", zeroDecimal: true },
  { code: "CD", name: "République démocratique du Congo", currency: "CDF", dial: "243", zeroDecimal: true },
  { code: "CI", name: "Côte d'Ivoire", currency: "XOF", dial: "225", zeroDecimal: true },
  { code: "GA", name: "Gabon", currency: "XAF", dial: "241", zeroDecimal: true },
  { code: "GH", name: "Ghana", currency: "GHS", dial: "233", zeroDecimal: false },
  { code: "GN", name: "Guinée", currency: "GNF", dial: "224", zeroDecimal: true },
  { code: "KE", name: "Kenya", currency: "KES", dial: "254", zeroDecimal: false },
  { code: "ML", name: "Mali", currency: "XOF", dial: "223", zeroDecimal: true },
  { code: "NE", name: "Niger", currency: "XOF", dial: "227", zeroDecimal: true },
  { code: "NG", name: "Nigeria", currency: "NGN", dial: "234", zeroDecimal: false },
  { code: "RW", name: "Rwanda", currency: "RWF", dial: "250", zeroDecimal: true },
  { code: "SN", name: "Sénégal", currency: "XOF", dial: "221", zeroDecimal: true },
  { code: "TG", name: "Togo", currency: "XOF", dial: "228", zeroDecimal: true },
];

export function findCountry(code: string): SupportedCountry | undefined {
  return SUPPORTED_COUNTRIES.find((c) => c.code === code.toUpperCase());
}

/**
 * Nettoie un numéro saisi et renvoie sa forme locale (sans indicatif ni 0
 * initial) et sa forme internationale stricte (ex. 243XXXXXXXXX).
 */
export function normalizeMobile(
  raw: string,
  country: SupportedCountry,
): { local: string; international: string } {
  let digits = raw.replace(/[^0-9]/g, "");
  // Retire un éventuel 00 international puis l'indicatif du pays.
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith(country.dial) && digits.length > country.dial.length) {
    digits = digits.slice(country.dial.length);
  }
  // Retire le 0 national initial.
  digits = digits.replace(/^0+/, "");
  return { local: digits, international: `${country.dial}${digits}` };
}


export function formatLocalAmount(amount: number, currency: string): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(amount)} ${currency}`;
}

/**
 * Préfixes réels par opérateur, quand l'API renvoie un format générique
 * identique pour tous les opérateurs d'un pays (cas de la RDC).
 */
const OPERATOR_PREFIXES: Record<string, { match: string[]; prefixes: string[] }[]> = {
  CD: [
    { match: ["airtel"], prefixes: ["99", "98", "97"] },
    { match: ["vodacom", "mpesa", "m-pesa"], prefixes: ["81", "82", "83"] },
    { match: ["orange"], prefixes: ["80", "84", "85", "89"] },
    { match: ["africell"], prefixes: ["90"] },
  ],
};

/** Préfixes attendus pour un opérateur donné, ou `null` si non spécifié. */
export function operatorPrefixes(countryCode: string, methodLabel: string): string[] | null {
  const rules = OPERATOR_PREFIXES[countryCode.toUpperCase()];
  if (!rules) return null;
  const label = methodLabel.toLowerCase();
  const rule = rules.find((r) => r.match.some((m) => label.includes(m)));
  return rule ? rule.prefixes : null;
}

