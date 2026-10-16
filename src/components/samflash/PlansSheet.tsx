import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listCountries, listPrices, quotePrice, CREDIT_MIN, CREDIT_MAX, type PriceRow } from "@/lib/payments.functions";
import { supabase } from "@/integrations/supabase/client";
import { activatePromoOffer, getPromoSettings, PROMO_DAYS } from "@/lib/promo.functions";
import { toast } from "@/lib/toast";
import { CheckoutSheet } from "@/components/samflash/CheckoutSheet";
import { formatLocalAmount } from "@/lib/payments/countries";
import { X, Zap, Sparkles, Rocket, FolderPlus, MonitorPlay, Brain, Infinity as InfinityIcon, Check, Gift } from "lucide-react";
import nightSky from "@/assets/night-sky.jpg";
import { useAuth } from "@/hooks/useAuth";
import { creditCostFor } from "@/lib/credits";
import { detectCountry } from "@/lib/country.functions";

/** Affiche un nombre qui glisse en douceur vers sa nouvelle valeur (ease-out cubique). */
function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const [display, setDisplay] = useState(value);
  const shown = useRef(value);
  useEffect(() => {
    const from = shown.current;
    const start = performance.now();
    const duration = 600;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (value - from) * eased);
      shown.current = next;
      setDisplay(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span className="tabular-nums">{format(display)}</span>;
}

/** Désactive les animations pour les personnes qui le demandent dans leurs réglages. */
function PlansStyles() {
  return (
    <style>{`
      @keyframes sf-float { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(18px,-26px,0) scale(1.08); } }
      @keyframes sf-bob { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-6px) rotate(2deg); } }
      @keyframes sf-shine { 0% { transform: translateX(-120%); } 60%,100% { transform: translateX(120%); } }
      .sf-blob { animation: sf-float 14s ease-in-out infinite; }
      .sf-blob-2 { animation: sf-float 18s ease-in-out infinite reverse; }
      .sf-bob { animation: sf-bob 3.2s ease-in-out infinite; }
      .sf-shine { animation: sf-shine 3.5s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        [class*="animate-in"], [class*="transition"], .sf-blob, .sf-blob-2, .sf-bob, .sf-shine { animation: none !important; transition: none !important; }
      }
    `}</style>
  );
}

type PlanId = "light" | "pro" | "custom";

type Plan = {
  id: PlanId;
  /** Identifiant de la ligne dans la table product_prices. */
  dbId: string;
  /** Masqué tant que le prix sur mesure n'est pas géré côté serveur. */
  hidden?: boolean;
  label: string;
  badge?: string;
  tagline: React.ReactNode;
  features: { icon: React.ElementType; title: string; sub?: string }[];
  cta: string;
  footnote: string;
};

const PLANS: Plan[] = [
  {
    id: "light",
    dbId: "base",
    label: "Sam Flash Light",
    tagline: <>Tous les outils IA dans un seul abonnement</>,
    features: [
      { icon: Check, title: "110 crédits par mois" },
      { icon: Check, title: "22 vidéos de 5 secondes en 480p" },
      { icon: Check, title: "Images, ChatGPT, Claude AI, clonage vidéo, avatar AI" },
    ],
    cta: "Choisir Sam Flash Light",
    footnote: "Facturation mensuelle, annulez à tout moment",
  },
  {
    id: "pro",
    dbId: "plus",
    label: "Sam Flash Pro",
    tagline: <>Le plus de crédits, sans limite de qualité</>,
    features: [
      { icon: Check, title: "400 crédits payés + 50 crédits offerts chaque mois" },
      { icon: Check, title: "Environ 90 vidéos de 5 secondes en 480p" },
      { icon: Check, title: "Vidéo 1080p, générations prioritaires" },
      { icon: Check, title: "Images, ChatGPT (GPT 6 Astra), Claude AI, clonage vidéo, avatar AI" },
      { icon: Check, title: "Paiement par Mobile Money ou carte bancaire" },
    ],
    cta: "Choisir Sam Flash Pro",
    footnote: "Facturation mensuelle, annulez à tout moment",
  },
  {
    id: "custom",
    dbId: "custom",
    label: "Sur mesure",
    tagline: <>Choisissez vous-même votre nombre de crédits</>,
    features: [
      { icon: Sparkles, title: "Images et vidéos IA", sub: "Vidéos HD 720p de 6 secondes" },
      { icon: Brain, title: "ChatGPT (GPT 6 Astra)", sub: "Discussion et programmation" },
      { icon: Brain, title: "Claude AI", sub: "Discussion et programmation" },
      { icon: MonitorPlay, title: "Clonage vidéo", sub: "Reproduisez les mouvements d'une vidéo" },
      { icon: Sparkles, title: "Avatar AI", sub: "Un avatar qui parle à partir d'une photo" },
      { icon: Zap, title: "Paiement par Mobile Money", sub: "Sans carte bancaire" },
    ],
    cta: "Passer à Sur mesure",
    footnote: "Facturation mensuelle, annulez à tout moment",
  },
];

/** Crédits inclus par mois (même calcul que le serveur). */
function includedCredits(p: PriceRow, yearly: boolean): number {
  if (p.id === "custom") return 110;
  if (p.credits_fixed !== null) return Math.round(p.credits_fixed);
  const base = yearly && p.amount_eur_yearly !== null ? p.amount_eur_yearly / 12 : p.amount_eur;
  return Math.round(base * (p.credits_rate ?? 0)) + Math.round(p.credits_bonus ?? 0);
}

/** Lignes de crédits calculées comme le chiffre affiché au-dessus (évite les incohérences). */
function featuresFor(plan: Plan, total: number, bonus: number, imagesFree: number | null = null): Plan["features"] {
  if (plan.id === "custom") return plan.features;
  const paid = bonus > 0 ? total - bonus : total;
  const credits = {
    icon: Check,
    title: bonus > 0 ? `${paid} crédits payés + ${bonus} crédits offerts chaque mois` : `${total} crédits par mois`,
  };
  const videos = {
    icon: Check,
    title: `${plan.id === "pro" ? "Environ " : ""}${Math.floor(total / creditCostFor("video", 5, "480p"))} vidéos de 5 secondes en 480p`,
  };
  const imagesCount = imagesFree ?? Math.floor(total / 5);
  const images = { icon: Check, title: `Jusqu'à ${imagesCount.toLocaleString("fr-FR")} images gratuites` };
  return [credits, videos, images, ...plan.features.slice(2)];
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
  const [active, setActive] = useState<PlanId>("light");
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
    amountFcfa: number;
    amountLocal: number;
    currency: string;
    discountEur: number;
    discountPercent: number | null;
    credits: number;
  } | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [trialOpen, setTrialOpen] = useState(false);
  const [trialCheckout, setTrialCheckout] = useState(false);
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

  const plan = PLANS.find((p) => p.id === active) ?? PLANS[0];
  const trialRow = prices.find((p) => p.id === "pack_essai");
  // Seules les offres d'abonnement sont affichées ici (les recharges sont retirées).
  const price = prices.find((p) => p.id === plan.dbId && p.tier !== "credits");
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
              amountFcfa: Number(q.amountFcfa ?? 0),
              amountLocal: q.amountLocal,
              currency: q.currency,
              discountEur: q.discountEur,
              discountPercent: q.discountPercent,
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

  const promoAmount = promo.enabled ? (promo.prices[plan.dbId] ?? null) : null;
  const promoFree = false;

  const claimPromo = async () => {
    setActivating(true);
    try {
      const result = await activatePromo({});
      if (result.ok) {
        toast.success(`Offre de lancement activée : Sam Flash vous est offert ${PROMO_DAYS} jours.`);
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

      <div className="relative flex flex-1 flex-col px-5 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] pt-4">
        <button
          type="button"
          aria-label="Fermer"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground"
        >
          <X className="h-6 w-6" />
        </button>

        <PlansStyles />
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="sf-blob absolute -left-16 top-10 h-72 w-72 rounded-full bg-primary/25 blur-3xl" />
          <div className="sf-blob-2 absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl" />
          <div className="sf-blob absolute bottom-10 left-1/4 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
        </div>
        {(
          <button
            type="button"
            onClick={() => setTrialOpen(true)}
            className="sf-bob relative mx-auto mt-1 inline-flex items-center gap-2 self-center overflow-hidden rounded-full border border-primary/40 bg-primary/15 px-4 py-2 text-sm font-semibold text-primary shadow-[var(--shadow-glow)] backdrop-blur-xl transition-transform active:scale-95 disabled:opacity-60"
          >
            <Gift className="h-4 w-4" />
            Offre d'essai Grok
            <span className="sf-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          </button>
        )}
        <div key={`hdr-${plan.id}`} className="mt-2 text-center animate-in fade-in slide-in-from-top-2 duration-500">
          <h2 className="motion-apple inline-flex items-center gap-3 text-4xl font-semibold tracking-tight">
            Sam flash
            {plan.badge && (
              <span className="rounded-xl bg-secondary px-3 py-1 text-lg font-medium">{plan.badge}</span>
            )}
          </h2>
          <p className="mt-1 text-sm font-medium text-primary/90">Studio IA</p>
          <p className="mt-2 text-xl font-medium text-foreground/90">{plan.tagline}</p>
        </div>

        <div className="relative mx-auto mt-6 flex w-full max-w-sm flex-col sm:flex-row rounded-3xl sm:rounded-full border border-border bg-secondary/40 p-1 backdrop-blur-xl">
          {/* Indicateur glissant : se déplace jusqu'à l'onglet choisi */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1 top-1 bottom-1 rounded-full bg-secondary shadow-[var(--shadow-glow)] transition-transform duration-500 ease-out sm:rounded-full"
            style={{
              width: `calc((100% - 0.5rem) / ${PLANS.length})`,
              transform: `translateX(${Math.max(0, PLANS.findIndex((p) => p.id === active)) * 100}%)`,
            }}
          />
          {PLANS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActive(p.id)}
              className={`relative z-10 flex-1 rounded-full py-2.5 px-2 text-[13px] sm:text-[15px] font-medium transition-colors duration-300 active:scale-95 ${
                active === p.id ? "text-foreground" : "text-muted-foreground"
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

          {/* Forfait fixe : crédits imposés */}
          {price && plan.id !== "custom" && (
            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Crédits inclus par mois</span>
                <span className="text-xl font-semibold">{sliderValue.toLocaleString("fr-FR")}</span>
              </div>
              <p className="text-sm">
                ≈ <span className="font-semibold">{videosPossible}</span> vidéos de 5 s en 480p par mois
              </p>
            </div>
          )}

          {/* Curseur de crédits (plan sur mesure uniquement) */}
          {price && plan.id === "custom" && (
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
                  Prix : {formatLocalAmount(unitLocal, selectedCountry.currency)} par crédit
                </p>
              )}
              {quote && selectedCountry && plan.id === "custom" && (
                <p className="text-sm">
                  Total : <span className="font-semibold">{formatLocalAmount(quote.amountLocal, selectedCountry.currency)}</span>
                  {yearly ? " pour 12 mois" : " par mois"}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Les crédits non utilisés expirent après 10 jours.{yearlyNote}
              </p>
            </div>
          )}

          {plan.id === "custom" && (
          <button
            type="button"
            onClick={() => setShowFeatures((v) => !v)}
            className="w-full text-left text-sm font-medium text-primary"
          >
            {showFeatures ? "Masquer ce qui est inclus" : "Voir ce qui est inclus"}
          </button>
          )}
          {(showFeatures || plan.id !== "custom") &&
            featuresFor(plan, sliderValue, Number(price?.credits_bonus ?? 0), price?.images_free ?? null).map((f, i) => (
              <div
                key={f.title}
                style={{ animationDelay: `${i * 80}ms` }}
                className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
              >
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
            <p className="text-sm text-primary">Code {promoApplied} appliqué : −{quote.discountPercent ?? 0} %</p>
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
              : quote
                ? <AnimatedNumber value={quote.amountLocal} format={(n) => formatLocalAmount(n, quote.currency)} />
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

        {trialOpen && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-background/70 p-4 backdrop-blur-md sm:items-center animate-in fade-in duration-300">
            <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-primary/40 bg-card p-6 shadow-[var(--shadow-glow)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
              <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/30 blur-3xl" />
              <button
                type="button"
                onClick={() => setTrialOpen(false)}
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
              <span className="sf-bob inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 text-primary">
                <Gift className="h-7 w-7" />
              </span>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Offre d'essai</p>
              <p className="mt-1 text-4xl font-semibold tabular-nums">
                {trialRow ? (((trialRow as { amount_fcfa?: number | null }).amount_fcfa ?? Math.round(trialRow.amount_eur * 655.957))).toLocaleString("fr-FR") : "2 000"}
                <span className="ml-2 text-base font-medium text-muted-foreground">FCFA</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {Number(trialRow?.credits_fixed ?? 40)} crédits · pack ponctuel, sans abonnement
              </p>
              <ul className="mt-5 space-y-3">
                {[
                  `Soit ${Math.floor(Number(trialRow?.credits_fixed ?? 40) / creditCostFor("video", 5, "480p"))} vidéos de 5 secondes en 480p`,
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
                  setTrialOpen(false);
                  setTrialCheckout(true);
                }}
                className="mt-6 w-full rounded-full bg-foreground py-4 text-[17px] font-semibold text-background transition-transform active:scale-[0.98]"
              >
                Continuer vers le paiement
              </button>
            </div>
          </div>
        )}

        {trialCheckout && (
          <CheckoutSheet
            productId="pack_essai"
            productLabel="Offre d'essai"
            period="monthly"
            countryCode={countryCode}
            credits={Number(trialRow?.credits_fixed ?? 40)}
            onClose={() => setTrialCheckout(false)}
          />
        )}

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
