import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Gift, X } from "lucide-react";
import { listPrices, type PriceRow } from "@/lib/payments.functions";
import { CheckoutSheet } from "@/components/samflash/CheckoutSheet";

/** Cadeau flottant « Offre d'essai Grok » : présente le pack d'essai puis mène au paiement. */
export function TrialGift({ visible = true }: { visible?: boolean }) {
  const fetchPrices = useServerFn(listPrices);
  const [trialRow, setTrialRow] = useState<PriceRow | null>(null);
  const [open, setOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);

  useEffect(() => {
    if (!visible) return;
    fetchPrices({})
      .then((rows) => setTrialRow((rows as PriceRow[]).find((r) => r.id === "pack_essai") ?? null))
      .catch(() => undefined);
  }, [fetchPrices, visible]);

  if (!visible) return null;

  const amount =
    (trialRow as { amount_fcfa?: number | null } | null)?.amount_fcfa ??
    (trialRow ? Math.round(trialRow.amount_eur * 655.957) : 2000);
  const credits = Number(trialRow?.credits_fixed ?? 40);

  return (
    <>
      <div className="relative mx-auto mt-2 flex justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="sf-bob relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-primary/40 bg-primary/15 px-4 py-2 text-sm font-semibold text-primary shadow-[var(--shadow-glow)] backdrop-blur-xl transition-transform active:scale-95"
        >
          <Gift className="h-4 w-4" />
          Offre d'essai Grok
          <span className="sf-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-background/70 p-4 backdrop-blur-md sm:items-center animate-in fade-in duration-300">
          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-primary/40 bg-card p-6 shadow-[var(--shadow-glow)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
            <span className="sf-bob inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 text-primary">
              <Gift className="h-7 w-7" />
            </span>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Offre d'essai Grok</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums">
              {amount.toLocaleString("fr-FR")}
              <span className="ml-2 text-base font-medium text-muted-foreground">FCFA</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{credits} crédits · pack ponctuel, sans abonnement</p>
            <ul className="mt-5 space-y-3">
              {[
                `Soit ${Math.floor(credits / 5)} vidéos de 5 secondes en 480p`,
                "Pour tester sans vous engager",
                "Paiement par Mobile Money",
              ].map((t, i) => (
                <li
                  key={t}
                  style={{ animationDelay: `${150 + i * 90}ms` }}
                  className="flex items-center gap-3 text-[15px] font-medium animate-in fade-in slide-in-from-left-4 fill-mode-both duration-500"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <Check className="h-4 w-4" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setCheckout(true);
              }}
              className="mt-6 w-full rounded-full bg-foreground py-4 text-[17px] font-semibold text-background transition-transform active:scale-[0.98]"
            >
              Continuer vers le paiement
            </button>
          </div>
        </div>
      )}

      {checkout && (
        <CheckoutSheet
          productId="pack_essai"
          productLabel="Offre d'essai Grok"
          period="monthly"
          credits={credits}
          onClose={() => setCheckout(false)}
        />
      )}
    </>
  );
}
