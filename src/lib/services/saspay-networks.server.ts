/**
 * Codes réseau SasPay pour le paiement direct (serveur uniquement).
 * Périmètre : RDC (CD), Bénin (BJ), Mali (ML). Codes repris du catalogue FlashPay.
 */

import { SASPAY_DIRECT_COUNTRIES } from "@/lib/payments/saspay-direct";

type Option = { label: string[]; code: string };

const CATALOGUE: Record<string, Option[]> = {
  BJ: [
    { label: ["mtn"], code: "mtn_bj" },
    { label: ["moov"], code: "moov_bj" },
    { label: ["celtiis"], code: "celtiis_bj" },
  ],
  CD: [
    { label: ["airtel"], code: "airtel_cd" },
    { label: ["orange"], code: "orange_cd" },
    { label: ["mpesa", "m-pesa", "vodacom"], code: "vodacom_cd" },
  ],
  ML: [
    { label: ["orange"], code: "orange_ml" },
    { label: ["moov"], code: "moov_ml" },
    { label: ["mobi"], code: "mobi_cash_ml" },
  ],
};

/** Code SasPay exact pour un pays et un libellé d’opérateur, ou null si absent du catalogue. */
export function resolveSaspayNetwork(countryIso: string, operatorLabel: string): string | null {
  const options = CATALOGUE[countryIso.toUpperCase()] ?? [];
  const label = operatorLabel.toLowerCase();
  const hit = options.find((o) => o.label.some((l) => label.includes(l)));
  return hit ? hit.code : null;
}
