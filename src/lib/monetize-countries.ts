/** Pays africains (codes ISO 2 lettres) : bouton « Ajouter l'Afrique » dans l'admin Monétise. */
export const AFRICA_CODES = [
  "DZ","AO","BJ","BW","BF","BI","CV","CM","CF","TD","KM","CG","CD","CI","DJ","EG","GQ","ER","SZ","ET",
  "GA","GM","GH","GN","GW","KE","LS","LR","LY","MG","MW","ML","MR","MU","MA","MZ","NA","NE","NG","RW",
  "ST","SN","SC","SL","SO","ZA","SS","SD","TZ","TG","TN","UG","ZM","ZW",
];

/** Nom d'un pays en français à partir de son code. */
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["fr"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Normalise une liste saisie à la main (« fr, us ; SN ») en codes valides sans doublons. */
export function parseCountryCodes(input: string): string[] {
  const codes = input
    .split(/[\s,;]+/)
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
  return [...new Set(codes)];
}
