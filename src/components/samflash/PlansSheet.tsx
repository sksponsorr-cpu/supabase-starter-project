import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listCountries, listPrices, quotePrice, CREDIT_MIN, CREDIT_MAX, type PriceRow } from "@/lib/payments.functions";
import { supabase } from "@/integrations/supabase/client";
import { activatePromoOffer, getPromoSettings, PROMO_DAYS } from "@/lib/promo.functions";
import { toast } from "@/lib/toast";
import { CheckoutSheet } from "@/components/samflash/CheckoutSheet";
import { formatLocalAmount } from "@/lib/payments/countries";
import { X, Zap, Sparkles, Rocket, FolderPlus, MonitorPlay, Brain, Infinity as InfinityIcon, Check } from "lucide-react";
import nightSky from "@/assets/night-sky.jpg";
import { useAuth } from "@/hooks/useAuth";
import { creditCostFor } from "@/lib/credits";
import { detectCountry } from "@/lib/country.functions";

type PlanId = "base" | "plus" | "heavy";

type Plan = {
  id: PlanId;
  label: string;
  badge?: string;
  tagline: React.ReactNode;
  features: { icon: React.ElementType; title: string; sub?: string }[];
  cta: string;
  footnote: string;
};

const PLANS: Plan[] = [
  {
    id: "base",
    label: "Super grok",
    tagline: <>Créez sans limite avec Super grok</>,
    features: [
      { icon: Sparkles, title: "Créez des images et des vidéos IA époustouflantes", sub: "Avec des vidéos HD 720p de 6 secondes" },
      { icon: FolderPlus, title: "Importez plus de fichiers pour des réponses plus pertinentes" },
      { icon: Zap, title: "Des réponses fulgurantes" },
    ],
    cta: "Passer à Super grok",
    footnote: "Facturation mensuelle, annulez à tout moment",
  },
  {
    id: "plus",
    label: "Super grok plus",
    tagline: <>Plus de créations, plus de puissance</>,
    features: [
      { icon: Check, title: "Tout dans Super grok" },
      { icon: MonitorPlay, title: "Vidéo 1080p en création" },
      { icon: Rocket, title: "Générations prioritaires" },
      { icon: InfinityIcon, title: "Crédits mensuels étendus" },
    ],
    cta: "Passer à Super grok plus",
    footnote: "Facturation mensuelle, annulez à tout moment",
  },
  {
    id: "heavy",
    label: "Super grok heavy",
    badge: "Heavy",
    tagline: <>La version la plus puissante de Sam flash</>,
    features: [
      { icon: Check, title: "Tout dans Super grok plus" },
      { icon: MonitorPlay, title: "Vidéo native 1080p en création" },
      { icon: Rocket, title: "Utilisation la plus élevée à la vitesse la plus rapide" },
      { icon: Brain, title: "Résolution des problèmes les plus complexes" },
      { icon: Sparkles, title: "Accès anticipé aux nouveaux modèles" },
    ],
    cta: "Passer à Super grok heavy",
    footnote: "Facturation mensuelle, annulez à tout moment",
  },
];

/** Crédits inclus par mois (même calcul que le serveur). */
function includedCredits(p: PriceRow, yearly: boolean): number {
  if (p.credits_fixed !== null) return Math.round(p.credits_fixed);
  const base = yearly && p.amount_eur_yearly !== null ? p.amount_eur_yearly / 12 : p.amount_eur;
  return Math.round(base * (p.credits_rate ?? 0)) + Math.round(p.credits_bonus ?? 0);
}

/** Fuseaux horaires et régions des pays pris en charge (détection sur l'appareil). */
const TIMEZONE_COUNTRY: Record<string, string> = {
  "Africa/Kinshasa": "CD", "Africa/Lubumbashi": "CD", "Africa/Porto-Novo": "BJ", "Africa/Ouagadougou": "BF",
  "Africa/Douala": "CM", "Africa/Bangui": "CF", "Africa/Ndjamena": "TD", "Africa/Brazzaville": "CG",
  "Africa/Abidjan": "CI", "Africa/Libreville": "GA", "Africa/Accra": "GH", "Africa/Conakry": "GN",
  "Africa/Nairobi": "KE", "Africa/Bamako": "ML", "Africa/Niamey": "NE", "Africa/Lagos": "NG",
  "Africa/Kigali": "RW", "Africa/Dakar": "SN", "Africa/Lome": "TG",
};

/** Pays déduit de l'appareil : fuseau horaire, puis région de la langue (ex. fr-CD). */
function countryFromDevice(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_COUNTRY[tz]) return TIMEZONE_COUNTRY[tz];
  } catch {
    // ignoré : on passe à la langue
  }
  const region = (navigator.language || "").split("-")[1];
  return region ? region.toUpperCase() : null;
}

/** Pays choisi manuellement par l'utilisateur (prioritaire sur la détection). */
function manualCountry(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("sf_country_manual");
}

export function PlansSheet({ onClose }: { onClose: () => void }) {
  const [active, setActive] = useState<PlanId>("base");
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [pricesLoaded, setPricesLoaded] = useState(false);
  const [countries, setCountries] = useState<{ code: string; name: string; currency: string; zeroDecimal: boolean }[]>([]);
  const [countryCode, setCountryCode] = useState<string>(manualCountry() ?? "CD");
  const [detected, setDetected] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [showFeatures, setShowFeatures] = useState(false);
  const [promoApplied, setPromoApplied] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [quote, setQuote] = useState<{
    amountLocal: number;
    currency: string;
    discountEur: number;
    credits: number;
  } | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [activating, setActivating] = useState(false);
  const [promo, setPromo] = useState<{ enabled: boolean; prices: Record<string, number | null> }>({
    enabled: false,
    prices: {},
  });
  const { profile } = useAuth();

  const fetchPrices = useServerFn(listPrices);
  const fetchCountries = useServerFn(listCountries);
  const fetchQuote = useServerFn(quotePrice);
  const fetchPromo = useServerFn(getPromoSettings);
  const fetchDetected = useServerFn(detectCountry);
  const activatePromo = useServerFn(activatePromoOffer);

  const plan = PLANS.find((p) => p.id === active)!;
  // Seules les offres d'abonnement sont affichées ici (les recharges sont retirées).
  const price = prices.find((p) => p.id === active && p.tier !== "credits");
  const yearlyAvailable = price?.amount_eur_yearly !== null && price?.amount_eur_yearly !== undefined;
  const yearly = period === "yearly" && yearlyAvailable;
  const baseCredits = price ? includedCredits(price, yearly) : 0;
  const minCredits = CREDIT_MIN;
  const maxCredits = CREDIT_MAX;
  const sliderValue = credits ?? baseCredits;

  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      fetchPrices({})
        .then((rows) => {
          if (cancelled) return;
          setPrices(rows as PriceRow[]);
          setPricesLoaded(true);
        })
        .catch(() => {
          if (!cancelled) setPricesLoaded(true);
        });
    void refresh();
    const channel = supabase
      .channel("product_prices_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "product_prices" }, () => {
        void refresh();
      })
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [fetchPrices]);

  useEffect(() => {
    fetchCountries({})
      .then((list) => setCountries(list as { code: string; name: string; currency: string; zeroDecimal: boolean }[]))
      .catch(() => setCountries([]));
  }, [fetchCountries]);

  // Détection automatique : appareil d'abord, puis adresse IP. Le choix manuel reste prioritaire.
  const [deviceCountry] = useState<string | null>(() => countryFromDevice());
  useEffect(() => {
    let cancelled = false;
    fetchDetected({})
      .then((r) => {
        if (!cancelled && r.code) setDetected(r.code);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [fetchDetected]);

  useEffect(() => {
    if (manualCountry() || countries.length === 0) return;
    const supported = (code: string | null) => !!code && countries.some((c) => c.code === code);
    if (supported(deviceCountry)) setCountryCode(deviceCountry!);
    else if (supported(detected)) setCountryCode(detected!);
  }, [deviceCountry, detected, countries]);

  useEffect(() => {
    fetchPromo({})
      .then((p) => setPromo(p))
      .catch(() => setPromo({ enabled: false, prices: {} }));
  }, [fetchPromo]);

  // Réinitialise le curseur quand on change d'offre ou de période.
  useEffect(() => {
    setCredits(null);
  }, [active, period]);

  // Devis en temps réel (curseur, pays, période, code promo).
  useEffect(() => {
    if (!price) return;
    let cancelled = false;
    setQuoteBusy(true);
    const timer = window.setTimeout(() => {
      fetchQuote({
        data: {
          productId: price.id,
          countryCode,
          period,
          credits: sliderValue,
          promoCode: promoApplied ?? undefined,
        },
      })
        .then((q) => {
          if (cancelled) return;
          if (q.ok) {
            setPromoError(null);
            setQuote({
              amountLocal: q.amountLocal,
              currency: q.currency,
              discountEur: q.discountEur,
              credits: q.credits,
            });
          } else {
            setQuote(null);
            if (promoApplied) {
              setPromoError(q.message);
              setPromoApplied(null);
            }
          }
        })
        .catch(() => {
          if (!cancelled) setQuote(null);
        })
        .finally(() => {
          if (!cancelled) setQuoteBusy(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [price?.id, countryCode, period, sliderValue, promoApplied, fetchQuote]);

  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoError(null);
    setPromoApplied(code);
  };

  const changeCountry = (code: string) => {
    setCountryCode(code);
    window.localStorage.setItem("sf_country_manual", code);
  };

  const promoAmount = promo.enabled ? (promo.prices[active] ?? null) : null;
  const promoFree = promo.enabled && promoAmount === 0;

  const claimPromo = async () => {
    setActivating(true);
    try {
      const result = await activatePromo({});
      if (result.ok) {
        toast.success(`Offre de lancement activée : Super grok vous est offert ${PROMO_DAYS} jours.`);
        onClose();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Activation impossible.");
    } finally {
      setActivating(false);
    }
  };

  const videosPossible = useMemo(() => {
    const cost = creditCostFor("video", 5, "480p");
    return Math.floor(sliderValue / cost);
  }, [sliderValue]);

  const selectedCountry = countries.find((c) => c.code === countryCode);
  const rawUnit = quote && sliderValue > 0 ? quote.amountLocal / sliderValue : null;
  const unitLocal =
    rawUnit !== null && selectedCountry
      ? selectedCountry.zeroDecimal
        ? Math.round(rawUnit)
        : Math.round(rawUnit * 100) / 100
      : null;
  const yearlyNote = yearly ? " · payé une fois pour 12 mois" : "";

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-80 opacity-70"
        style={{
          backgroundImage: `linear-gradient(to bottom, transparent, var(--background)), url(${nightSky})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      <div className="relative flex flex-1 flex-col px-5 pb-10 pt-4">
        <button
          type="button"
          aria-label="Fermer"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="mt-2 text-center">
          <h2 className="inline-flex items-center gap-3 text-4xl font-semibold tracking-tight">
            Sam flash
            {plan.badge && (
              <span className="rounded-xl bg-secondary px-3 py-1 text-lg font-medium">{plan.badge}</span>
            )}
          </h2>
          <p className="mt-1 text-sm font-medium text-primary/90">Studio IA</p>
          <p className="mt-2 text-xl font-medium text-foreground/90">{plan.tagline}</p>
        </div>

        <div className="mx-auto mt-6 flex w-full max-w-sm flex-col sm:flex-row rounded-3xl sm:rounded-full border border-border bg-secondary/40 p-1 backdrop-blur-xl">
          {PLANS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActive(p.id)}
              className={`flex-1 rounded-full py-2.5 px-2 text-[13px] sm:text-[15px] font-medium transition-colors ${
                active === p.id ? "bg-secondary text-foreground shadow-[var(--shadow-glow)]" : "text-muted-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Choix de la période */}
        {yearlyAvailable && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPeriod("monthly")}
              className={`rounded-2xl border p-3 text-left ${period === "monthly" ? "border-primary bg-secondary/60" : "border-border bg-card/40"}`}
            >
              <span className="text-muted-foreground">Mensuel</span>
            </button>
            <button
              type="button"
              onClick={() => setPeriod("yearly")}
              className={`rounded-2xl border p-3 text-left ${period === "yearly" ? "border-primary bg-secondary/60" : "border-border bg-card/40"}`}
            >
              <span className="text-muted-foreground">Annuel</span>
            </button>
          </div>
        )}

        <div className="mt-4 space-y-4 rounded-2xl border border-border bg-card/50 p-4 backdrop-blur-xl">
          {/* Pays : détecté au premier passage, modifiable */}
          {detected && !countries.some((c) => c.code === detected) && !manualCountry() && (
            <p className="text-xs text-muted-foreground">
              Votre pays n'est pas encore pris en charge. Choisissez un pays proche ci-dessous.
            </p>
          )}
          {countries.length > 0 && (
            <label className="block text-sm">
              <span className="text-muted-foreground">Votre pays</span>
              <select
                value={countryCode}
                onChange={(e) => changeCountry(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
              >
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.currency})
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Curseur de crédits */}
          {price && (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Crédits par mois</span>
                <span className="text-xl font-semibold">{sliderValue.toLocaleString("fr-FR")}</span>
              </div>
              <input
                type="range"
                min={minCredits}
                max={maxCredits}
                step={10}
                value={sliderValue}
                onChange={(e) => setCredits(Number(e.target.value))}
                className="w-full accent-primary"
                aria-label="Nombre de crédits par mois"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{minCredits}</span>
                <span>{maxCredits.toLocaleString("fr-FR")}</span>
              </div>
              <p className="text-sm">
                ≈ <span className="font-semibold">{videosPossible}</span> vidéos de 5 s en 480p par mois
              </p>
              {unitLocal !== null && selectedCountry && (
                <p className="text-xs text-muted-foreground">
                  Soit {formatLocalAmount(unitLocal, selectedCountry.currency)} par crédit
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Les crédits non utilisés expirent après 10 jours.{yearlyNote}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowFeatures((v) => !v)}
            className="w-full text-left text-sm font-medium text-primary"
          >
            {showFeatures ? "Masquer ce qui est inclus" : "Voir ce qui est inclus"}
          </button>
          {showFeatures &&
            plan.features.map((f) => (
              <div key={f.title} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <f.icon className="h-4 w-4 text-foreground" />
                </span>
                <span className="text-[15px] font-medium leading-snug">{f.title}</span>
              </div>
            ))}
        </div>

        {/* Code promo */}
        <div className="mt-4 space-y-2">
          <div className="flex gap-2">
            <input
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value)}
              placeholder="EX : BIENVENUE20"
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 uppercase"
            />
            <button
              type="button"
              onClick={applyPromo}
              className="rounded-xl bg-secondary px-4 py-2 text-sm font-medium"
            >
              Appliquer
            </button>
          </div>
          {promoApplied && quote && quote.discountEur > 0 && (
            <p className="text-sm text-primary">Code {promoApplied} appliqué : −{quote.discountEur.toFixed(2)} €</p>
          )}
          {promoError && <p className="text-sm text-destructive">{promoError}</p>}
        </div>

        {/* Prix total */}
        <div className="mt-4 rounded-2xl border border-border bg-card/40 p-4">
          <p className="text-sm text-muted-foreground">
            {period === "yearly" && yearly ? "Total pour 12 mois" : "Total par mois"}
          </p>
          <p className="mt-1 text-3xl font-semibold">
            {quoteBusy && !quote
              ? "…"
              : quote && selectedCountry
                ? formatLocalAmount(quote.amountLocal, quote.currency)
                : pricesLoaded
                  ? "Indisponible"
                  : "…"}
          </p>
        </div>

        <button
          type="button"
          disabled={activating || (!promoFree && !quote)}
          onClick={() => (promoFree ? void claimPromo() : setCheckoutOpen(true))}
          className="mt-6 w-full rounded-full bg-foreground py-4 text-[17px] font-semibold text-background transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {activating ? "Activation…" : promoFree ? "Activer l'offre de lancement (offerte)" : plan.cta}
        </button>

        {checkoutOpen && price && (
          <CheckoutSheet
            productId={price.id}
            productLabel={price.label}
            period={period}
            countryCode={countryCode}
            credits={sliderValue}
            promoCode={promoApplied}
            onClose={() => setCheckoutOpen(false)}
          />
        )}

        <p className="mt-3 text-center text-sm text-muted-foreground">
          {promoFree ? `Offre de lancement : ${PROMO_DAYS} jours offerts, sans paiement.` : plan.footnote}
        </p>

        <div className="mt-8 rounded-2xl border border-border bg-card/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Vos crédits</span>
            <span className="text-lg font-semibold">{profile?.credits_balance ?? 0}</span>
          </div>
          <a href="/tableau-de-bord" className="mt-4 block text-center text-sm font-medium text-primary">
            Voir mon tableau de bord
          </a>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Conditions d'utilisation · Politique de confidentialité
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">Sam flash 2.0 — Studio IA</p>
      </div>
    </div>
  );
}
