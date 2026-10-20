import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Gift, MousePointerClick, X } from "lucide-react";
import { detectCountry } from "@/lib/country.functions";
import { listPrices, type PriceRow } from "@/lib/payments.functions";
import { CheckoutSheet } from "@/components/samflash/CheckoutSheet";
import { samCreditsFor } from "@/lib/creator-pricing";

/** Cadeau flottant « Offre d'essai Sam Flash » : présente le pack d'essai puis mène au paiement. */
export function TrialGift({ visible = true }: { visible?: boolean }) {
  const fetchPrices = useServerFn(listPrices);
  const [trialRow, setTrialRow] = useState<PriceRow | null>(null);
  const [open, setOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const detect = useServerFn(detectCountry);
  const [countryCode, setCountryCode] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    detect({})
      .then((r) => setCountryCode(r.code))
      .catch(() => undefined);
  }, [detect, visible]);

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
      <style>{`
        @keyframes sf-halo { 0% { transform: scale(.9); opacity: .7; } 100% { transform: scale(1.9); opacity: 0; } }
        @keyframes sf-lid { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-5px) rotate(-12deg); } }
        @keyframes sf-point { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-4px,4px); } }
        @keyframes sf-spark { 0%,100% { opacity: 0; transform: scale(.4); } 50% { opacity: 1; transform: scale(1); } }
        .sf-halo { animation: sf-halo 2.4s ease-out infinite; }
        .sf-halo-2 { animation: sf-halo 2.4s ease-out 1.2s infinite; }
        .sf-lid { animation: sf-lid 2.6s ease-in-out infinite; transform-origin: 50% 100%; }
        .sf-point { animation: sf-point 1.2s ease-in-out infinite; }
        .sf-spark { animation: sf-spark 2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .sf-halo, .sf-halo-2, .sf-lid, .sf-point, .sf-spark { animation: none !important; } }
      `}</style>
      <div className="relative mx-auto mt-2 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative inline-flex items-center gap-3 overflow-visible rounded-full border border-primary/40 bg-primary/15 py-2 pl-2 pr-5 text-sm font-semibold text-primary shadow-[var(--shadow-glow)] backdrop-blur-xl transition-transform active:scale-95"
        >
          <span className="relative flex h-10 w-10 items-center justify-center">
            <span className="sf-halo absolute inset-0 rounded-full bg-primary/40" />
            <span className="sf-halo-2 absolute inset-0 rounded-full bg-fuchsia-500/30" />
            <span className="sf-lid relative flex h-9 w-9 items-center justify-center rounded-full bg-primary/25">
              <Gift className="h-5 w-5" />
            </span>
            <span className="sf-spark absolute -right-1 -top-1 text-[10px]">✦</span>
          </span>
          <span className="whitespace-nowrap">Offre d'essai Sam Flash</span>
          <span className="sf-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        </button>
        <MousePointerClick className="sf-point h-5 w-5 text-primary" aria-hidden />
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
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Offre d'essai Sam Flash</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums">
              {amount.toLocaleString("fr-FR")}
              <span className="ml-2 text-base font-medium text-muted-foreground">FCFA</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{credits} crédits · pack ponctuel, sans abonnement</p>
            <ul className="mt-5 space-y-3">
              {[
                `Soit ${Math.floor(credits / (samCreditsFor("grok-imagine", "480p", 6) ?? 1))} vidéos Grok Imagine en 480p`,
                `Jusqu'à ${Math.floor(credits / 5).toLocaleString("fr-FR")} images gratuites`,
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
          productLabel="Offre d'essai Sam Flash"
          period="monthly"
          credits={credits}
          countryCode={countryCode ?? undefined}
          onClose={() => setCheckout(false)}
        />
      )}
    </>
  );
}
