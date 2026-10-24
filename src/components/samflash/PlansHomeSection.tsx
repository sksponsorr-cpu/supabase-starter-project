import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { listPrices, type PriceRow } from "@/lib/payments.functions";
import { samCreditsFor, type PricedModel, type PricedResolution, type VeoTier } from "@/lib/creator-pricing";
import { EUR_TO_FCFA, formatFcfa } from "@/lib/pricing-fcfa";
import { addPaymentFees } from "@/lib/payments/fees";

/**
 * Offres d'abonnement de la page d'accueil.
 * Lit les mêmes prix et les mêmes crédits que la fenêtre d'abonnement (table product_prices).
 * Quand tu modifies une offre dans l'administration, cette page suit sans republier le site.
 */

/** Vidéos affichées par modèle : une configuration de référence, sans durée affichée. */
const SHOWCASE: { label: string; model: PricedModel; resolution: PricedResolution; seconds: number; tier?: VeoTier }[] = [
  { label: "Grok Imagine", model: "grok-imagine", resolution: "480p", seconds: 6 },
  { label: "Seedance 2.0", model: "seedance-2", resolution: "480p", seconds: 5 },
  { label: "Seedance 2.5", model: "seedance-2-5", resolution: "480p", seconds: 5 },
  { label: "Veo 3.1", model: "veo-3-1", resolution: "720p", seconds: 8, tier: "fast" },
];

/** Les deux offres d'abonnement publiques (mêmes identifiants que la fenêtre d'abonnement). */
const PUBLIC_PLANS: { dbId: string; highlight: boolean }[] = [
  { dbId: "base", highlight: false },
  { dbId: "plus", highlight: true },
];

/** Crédits inclus par mois, bonus compris (même calcul que la fenêtre d'abonnement). */
function includedCredits(p: PriceRow): number {
  if (p.credits_fixed !== null) return Math.round(p.credits_fixed);
  return Math.round(p.amount_eur * (p.credits_rate ?? 0)) + Math.round(p.credits_bonus ?? 0);
}

/** Montant en FCFA, arrondi à 100 FCFA, à partir du prix en euros enregistré. */
/** Montant affiché = montant payé : base arrondie à 100 FCFA + frais SwyChr (2,5 %). */
function fcfaFor(p: PriceRow): number {
  const base = Math.round((p.amount_eur * EUR_TO_FCFA) / 100) * 100;
  return addPaymentFees(base, true).total;
}

function videosFor(credits: number, item: (typeof SHOWCASE)[number]): number {
  const cost = samCreditsFor(item.model, item.resolution, item.seconds, item.tier ?? "fast");
  return cost ? Math.floor(credits / cost) : 0;
}

export function PlansHomeSection() {
  const fetchPrices = useServerFn(listPrices);
  const [rows, setRows] = useState<PriceRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPrices({})
      .then((list) => {
        if (!cancelled) setRows(list as PriceRow[]);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPrices]);

  const plans = PUBLIC_PLANS.map((pl) => ({ ...pl, row: rows?.find((r) => r.id === pl.dbId && r.tier !== "credits") })).filter(
    (pl) => !!pl.row,
  );

  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Abonnements</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Créez chaque mois, sans compter</h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-500">
          Un abonnement, tous les modèles vidéo. Choisissez le plan qui correspond à votre rythme.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {rows === null && <p className="col-span-full text-center text-sm text-slate-500">Chargement des offres…</p>}
        {rows !== null && plans.length === 0 && (
          <p className="col-span-full text-center text-sm text-slate-500">Les offres seront affichées ici très prochainement.</p>
        )}

        {plans.map(({ row, highlight }) => {
          const credits = includedCredits(row!);
          const fcfa = fcfaFor(row!);
          return (
            <div
              key={row!.id}
              className={`relative flex flex-col rounded-3xl border bg-white p-8 text-slate-900 transition ${
                highlight ? "border-blue-500 shadow-xl ring-1 ring-blue-500/30" : "border-slate-200 shadow-sm"
              }`}
            >
              {highlight && (
                <span className="absolute -top-3 right-6 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                  Le plus choisi
                </span>
              )}

              <h3 className="text-xl font-semibold">{row!.label}</h3>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-bold">{formatFcfa(fcfa)}</span>
                <span className="text-sm text-slate-500">/ mois</span>
              </p>
              <p className="mt-1 text-sm text-slate-500">soit {row!.amount_eur.toFixed(2).replace(".", ",")} € par mois</p>

              <div className="mt-6 rounded-2xl bg-slate-100 p-4">
                <p className="text-sm font-medium">{credits} crédits chaque mois</p>
                {(row!.credits_bonus ?? 0) > 0 && (
                  <p className="mt-1 text-xs text-slate-500">dont {row!.credits_bonus} crédits de bonus offerts</p>
                )}
              </div>

              <ul className="mt-6 space-y-3">
                {SHOWCASE.map((item) => (
                  <li key={item.model} className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-right text-slate-500">
                      jusqu'à <span className="font-semibold text-slate-900">{videosFor(credits, item)}</span> vidéos · {item.resolution}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                to="/app"
                className={`mt-8 inline-flex h-12 items-center justify-center rounded-full text-sm font-semibold transition ${
                  highlight ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                }`}
              >
                Choisir {row!.label}
              </Link>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-slate-500">
        Les nombres de vidéos sont indicatifs et dépendent du modèle et de la résolution choisis.
      </p>
    </section>
  );
}
