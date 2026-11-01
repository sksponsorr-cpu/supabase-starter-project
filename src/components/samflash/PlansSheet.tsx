import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { submitReview } from "@/lib/feedback.functions";
import { useServerFn } from "@tanstack/react-start";
import { PlansCards } from "@/components/samflash/PlansCards";
import { listCountries, listPrices, quotePrice, CREDIT_MIN, CREDIT_MAX, type PriceRow } from "@/lib/payments.functions";
import { supabase } from "@/integrations/supabase/client";
import { activatePromoOffer, getPromoSettings, PROMO_DAYS } from "@/lib/promo.functions";
import { toast } from "@/lib/toast";
import { CheckoutSheet } from "@/components/samflash/CheckoutSheet";
import { formatLocalAmount } from "@/lib/payments/countries";
import { X, Zap, Sparkles, Rocket, FolderPlus, MonitorPlay, Brain, Infinity as InfinityIcon, Check, Gift } from "lucide-react";
import nightSky from "@/assets/night-sky.jpg";
import { useAuth } from "@/hooks/useAuth";
import { samCreditsFor, type PricedModel, type PricedResolution, type VeoTier } from "@/lib/creator-pricing";
import { detectCountry } from "@/lib/country.functions";

/** Vidéos affichées par modèle, avec une configuration de référence (pas de durée affichée). */
const VIDEO_SHOWCASE: { label: string; model: PricedModel; resolution: PricedResolution; seconds: number; tier?: VeoTier }[] = [
  { label: "Grok Imagine", model: "grok-imagine", resolution: "480p", seconds: 6 },
  { label: "Seedance 2.0", model: "seedance-2", resolution: "480p", seconds: 5 },
  { label: "Seedance 2.5", model: "seedance-2-5", resolution: "480p", seconds: 5 },
  { label: "Veo 3.1", model: "veo-3-1", resolution: "720p", seconds: 8, tier: "fast" },
];

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
  features: { icon: React.ElementType; title: string; sub?: string; soon?: boolean }[];
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
      { icon: Check, title: "Veo 3.1 : 8 crédits par vidéo, quelle que soit la durée (4, 6 ou 8 s), en 720p" },
      { icon: Check, title: "Grok Imagine : 19 crédits pour une vidéo de 30 s en 720p" },
      { icon: Check, title: "Grok Imagine : 11 crédits pour une vidéo de 30 s en 480p" },
      { icon: Check, title: "22 vidéos" },
      { icon: Check, title: "Modèles : Grok Imagine, Seedance 2.0, Seedance 2.5, Veo 3.1, Google Omni" },
      { icon: Check, title: "Clonage vidéo" },
      { icon: Check, title: "Avatar AI" },
      { icon: Check, title: "ChatGPT", soon: true },
      { icon: Check, title: "Claude AI", soon: true },
      { icon: Check, title: "Mode vendeur : Image", sub: "Cloner une publicité, perruque portée, habiller un mannequin, produit en main" },
      { icon: Check, title: "Mode vendeur : Vidéo", sub: "Publicité UGC dynamique, pub voix off, clonage vidéo, rejouer une pub, changer le produit" },
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
      { icon: Check, title: "Veo 3.1 : 8 crédits par vidéo, quelle que soit la durée (4, 6 ou 8 s), en 720p" },
      { icon: Check, title: "Grok Imagine : 19 crédits pour une vidéo de 30 s en 720p" },
      { icon: Check, title: "Grok Imagine : 11 crédits pour une vidéo de 30 s en 480p" },
      { icon: Check, title: "Environ 90 vidéos" },
      { icon: Check, title: "Modèles : Grok Imagine, Seedance 2.0, Seedance 2.5, Veo 3.1, Google Omni" },
      { icon: Check, title: "Vidéo 1080p, générations prioritaires" },
      { icon: Check, title: "Clonage vidéo" },
      { icon: Check, title: "Avatar AI" },
      { icon: Check, title: "ChatGPT GPT 6 Astra", soon: true },
      { icon: Check, title: "Claude AI", soon: true },
      { icon: Check, title: "Paiement par Mobile Money ou carte bancaire" },
      { icon: Check, title: "Mode vendeur : Image", sub: "Cloner une publicité, perruque portée, habiller un mannequin, produit en main" },
      { icon: Check, title: "Mode vendeur : Vidéo", sub: "Publicité UGC dynamique, pub voix off, clonage vidéo, rejouer une pub, changer le produit" },
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
      { icon: Sparkles, title: "Images et vidéos IA", sub: "Vidéos HD 720p" },
      { icon: Brain, title: "ChatGPT (GPT 6 Astra)", sub: "Bientôt disponible" },
      { icon: Brain, title: "Claude AI", sub: "Bientôt disponible" },
      { icon: MonitorPlay, title: "Clonage vidéo", sub: "Reproduisez les mouvements d'une vidéo" },
      { icon: Sparkles, title: "Avatar AI", sub: "Un avatar qui parle à partir d'une photo" },
      { icon: Zap, title: "Paiement par Mobile Money", sub: "Sans carte bancaire" },
      { icon: MonitorPlay, title: "Mode vendeur : Image", sub: "Cloner une publicité, perruque portée, habiller un mannequin, produit en main" },
      { icon: MonitorPlay, title: "Mode vendeur : Vidéo", sub: "Publicité UGC dynamique, pub voix off, clonage vidéo, rejouer une pub, changer le produit" },
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
function featuresFor(plan: Plan, total: number, bonus: number, _imagesFree: number | null = null): Plan["features"] {
  if (plan.id === "custom") {
    return [
      { icon: Check, title: `${total.toLocaleString("fr-FR")} crédits par mois, au nombre de votre choix` },
      ...plan.features,
    ];
  }
  const paid = bonus > 0 ? total - bonus : total;
  const credits = {
    icon: Check,
    title: bonus > 0 ? `${paid.toLocaleString("fr-FR")} crédits payés + ${bonus.toLocaleString("fr-FR")} crédits offerts chaque mois` : `${total.toLocaleString("fr-FR")} crédits par mois`,
  };
  // Crédits et vidéos sont déjà affichés au-dessus : on ne les répète pas (sauf le détail payés + offerts).
  return [...(bonus > 0 ? [credits] : []), ...plan.features.slice(2)];
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

function CheckoutFeedback() {
  const send = useServerFn(submitReview);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await send({ data: { stars, comment: comment.trim() || undefined } });
      setSent(true);
    } catch {
      setError("Impossible d'envoyer votre avis pour le moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4 space-y-3">
      <p className="font-semibold">Votre avis avant d'acheter</p>
      <p className="text-sm text-muted-foreground">Qu'est-ce qui vous aiderait à vous décider ?</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Note">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setStars(n)}
            aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
            className={`text-2xl ${n <= stars ? "text-amber-400" : "text-muted-foreground"}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="Votre avis, ou ce qui vous manque pour acheter…"
        className="w-full rounded-xl border border-border bg-background/60 p-3 text-sm"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="button"
        disabled={busy || stars === 0 || sent}
        onClick={submit}
        className="rounded-full border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {sent ? "Merci pour votre avis" : busy ? "Envoi…" : "Envoyer mon avis"}
      </button>
    </div>
  );
}

export function PlansSheet({ onClose, initialPlan, detailOnly = false }: { onClose: () => void; initialPlan?: string; detailOnly?: boolean }) {
  const [active, setActive] = useState<PlanId>((initialPlan as PlanId) ?? "light");
  const navigate = useNavigate();
  const [viewDetail, setViewDetail] = useState(!!initialPlan || detailOnly);
  useEffect(() => {
    requestAnimationFrame(() => document.getElementById("plans-top")?.scrollIntoView({ block: "start" }));
  }, [initialPlan, viewDetail]);
  const [planQuotes, setPlanQuotes] = useState<Record<string, { amountLocal: number; currency: string } | null>>({});
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [pricesLoaded, setPricesLoaded] = useState(false);
  const [countries, setCountries] = useState<{ code: string; name: string; currency: string; zeroDecimal: boolean }[]>([]);
  const [countryCode, setCountryCode] = useState<string>(manualCountry() ?? "CD");
  const [detected, setDetected] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [showFeatures, setShowFeatures] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
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
  // Seules les offres d'abonnement sont affichées ici (les recharges sont retirées).
  const price = prices.find((p) => p.id === plan.dbId && p.tier !== "credits");
  const yearlyAvailable = price?.amount_eur_yearly !== null && price?.amount_eur_yearly !== undefined;
  const yearly = period === "yearly" && yearlyAvailable;
  const baseCredits = price ? includedCredits(price, yearly) : 0;
  const minCredits = CREDIT_MIN;
  const maxCredits = CREDIT_MAX;
  const sliderValue = credits ?? baseCredits;
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Prix et crédits de chaque offre, pour les cartes (même source que le détail ci-dessous).
  const rowFor = (dbId: string) => prices.find((r) => r.id === dbId && r.tier !== "credits");
  const creditsFor = (dbId: string) => {
    const row = rowFor(dbId);
    return row ? includedCredits(row, false) : 0;
  };
  // Nombre de vidéos par modèle pour les crédits de l'offre (vidéo de 6 s, même tarif que le détail).
  const videosLines = (dbId: string) => {
    const c = creditsFor(dbId);
    const line = (label: string, model: PricedModel, res: PricedResolution) => {
      const cost = samCreditsFor(model, res, 6) ?? 1;
      return `${label} : jusqu'à ${Math.floor(c / cost)} vidéos de 6 s · ${res}`;
    };
    return [
      line("Grok Imagine", "grok-imagine", "480p"),
      line("Seedance 2.0", "seedance-2", "480p"),
      line("Seedance 2.5", "seedance-2-5", "480p"),
      line("Veo 3.1", "veo-3-1", "720p"),
    ];
  };

  // Prix des cartes dans la devise du pays choisi, déduit du devis serveur (frais de 2,5 % retirés).
  // Prix de chaque carte : devis serveur de l'offre elle-même, dans la devise du pays (frais 2,5 % retirés pour l'affichage).
  const priceTextFor = (dbId: string) => {
    if (dbId === "custom") return "Vous choisissez";
    // Pas d'affichage en euros avant le devis : on attend le montant dans la devise du pays.
    const q = planQuotes[dbId];
    if (!q) return "Chargement du prix…";
    return `${formatLocalAmount(Math.round(q.amountLocal / 1.025), q.currency)} / ${period === "yearly" ? "an" : "mois"}`;
  };

  // Devis des trois offres, pour afficher leur prix exact sur les cartes.
  useEffect(() => {
    if (!pricesLoaded || !countryCode) return;
    let cancelled = false;
    setPlanQuotes({});
    PLANS.filter((p) => p.id !== "custom").forEach((p) => {
      const row = rowFor(p.dbId);
      if (!row) return;
      fetchQuote({ data: { productId: row.id, countryCode, period } })
        .then((q) => {
          if (cancelled || !q.ok) return;
          setPlanQuotes((prev) => ({ ...prev, [p.dbId]: { amountLocal: Number(q.amountLocal), currency: String(q.currency) } }));
        })
        .catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricesLoaded, countryCode, period, prices]);

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

  const videoRows = useMemo(
    () =>
      VIDEO_SHOWCASE.map((item) => {
        const cost = samCreditsFor(item.model, item.resolution, item.seconds, item.tier ?? "fast");
        return { ...item, count: cost ? Math.floor(sliderValue / cost) : 0 };
      }),
    [sliderValue],
  );

  const selectedCountry = countries.find((c) => c.code === countryCode);
  const rawUnit = quote && sliderValue > 0 ? quote.amountLocal / sliderValue : null;
  const unitLocal =
    rawUnit !== null && selectedCountry
      ? selectedCountry.zeroDecimal
        ? Math.round(rawUnit)
        : Math.round(rawUnit * 100) / 100
      : null;
  const unitCustom = rawUnit !== null ? Math.round(rawUnit * 100) / 100 : null;
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

      <div className="relative mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] pt-4 md:max-w-xl md:pt-8">
        <button
          type="button"
          aria-label="Fermer"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground"
        >
          <X className="h-6 w-6" />
        </button>

        <PlansStyles />
        <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="sf-blob absolute -left-16 top-10 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        </div>
        <div id="plans-top" />
        <div key={`hdr-${plan.id}`} className="mt-2 text-center animate-in fade-in slide-in-from-top-2 duration-500">
          <h2 className="motion-apple inline-flex items-center gap-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Sam flash
            {plan.badge && (
              <span className="rounded-xl bg-secondary px-3 py-1 text-lg font-medium">{plan.badge}</span>
            )}
          </h2>
          <p className="mt-1 text-sm font-medium text-primary/90">Studio IA</p>
          <p className="mt-2 text-xl font-medium text-foreground/90 md:text-2xl">{plan.tagline}</p>
        </div>

        {!viewDetail && (
        <div className="mt-6">
          <PlansCards
            selectedId={active}
            onSelect={(id) => {
              if (id === "essai") {
                toast.success("Vos 10 crédits gratuits sont disponibles dans Créer.");
                return;
              }
              setActive(id as PlanId);
              void navigate({ to: "/abonnements", search: { plan: id } });
            }}
            plans={[
            {
              id: "essai",
              name: "Gratuit",
              priceLabel: "0 FCFA",
              creditsLabel: "10 crédits par jour, renouvelés chaque jour",
              features: [
                "Vidéos de 6 secondes maximum",
                "Veo 3.1 : 8 crédits par vidéo",
                "Grok Imagine : 3 crédits par vidéo",
                "Seedance réservé aux abonnés",
                "File d'attente pour les comptes gratuits",
                "Sans paiement, sans carte",
              ],
              cta: "Commencer gratuitement",
            },
            ...PLANS.map((p) => ({
              id: p.id,
              name: p.label,
              priceLabel: priceTextFor(p.dbId),
              creditsLabel: `${creditsFor(p.dbId)} crédits inclus par mois`,
              features:
                p.id === "custom"
                  ? ["Vous choisissez vos crédits", "Veo 3.1 : 8 crédits par vidéo, toute durée (4, 6 ou 8 s), 720p", "Grok Imagine : 19 crédits pour 30 s en 720p", ...videosLines(p.dbId), "Sans engagement mensuel"]
                  : p.id === "pro"
                    ? ["Veo 3.1 : 8 crédits par vidéo, toute durée (4, 6 ou 8 s), 720p", "Grok Imagine : 19 crédits pour 30 s en 720p", "Grok Imagine : 11 crédits pour 30 s en 480p", ...videosLines(p.dbId), "Tous les modèles"]
                    : ["Veo 3.1 : 8 crédits par vidéo, toute durée (4, 6 ou 8 s), 720p", "Grok Imagine : 19 crédits pour 30 s en 720p", "Grok Imagine : 11 crédits pour 30 s en 480p", ...videosLines(p.dbId), "Crédits inclus chaque mois"],
              highlighted: p.id === "pro",
              cta: p.id === "custom" ? "Choisir mes crédits" : undefined,
            })),
          ]}
          />
        </div>
        )}

        {yearlyAvailable && (
          <div className="relative mx-auto mt-4 flex w-full max-w-[16rem] rounded-full border border-border bg-secondary/40 p-1 backdrop-blur-xl">
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-full bg-secondary shadow-[var(--shadow-glow)] transition-transform duration-500 ease-out"
              style={{ transform: `translateX(${period === "yearly" ? 100 : 0}%)` }}
            />
            <button
              type="button"
              onClick={() => setPeriod("monthly")}
              className={`relative z-10 flex-1 rounded-full py-2 text-sm font-medium transition-colors duration-300 ${period === "monthly" ? "text-foreground" : "text-muted-foreground"}`}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setPeriod("yearly")}
              className={`relative z-10 flex-1 rounded-full py-2 text-sm font-medium transition-colors duration-300 ${period === "yearly" ? "text-foreground" : "text-muted-foreground"}`}
            >
              Annuel
            </button>
          </div>
        )}

        <div id="plan-detail" className="mt-4 space-y-3 rounded-3xl border border-border bg-card/50 p-4 backdrop-blur-xl">
          {viewDetail && (
            <button
              type="button"
              onClick={() => {
                setCheckoutOpen(false);
                if (initialPlan) void navigate({ to: "/abonnements", search: {} });
                else setViewDetail(false);
              }}
              className="text-sm text-muted-foreground"
            >
              ← Retour aux offres
            </button>
          )}
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
                className="mt-1 w-full rounded-xl border-0 bg-secondary/60 px-3 py-2.5 text-[15px]"
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
          {/* Détail des crédits et des vidéos : seulement pour l'offre annuelle (le mensuel est déjà affiché sur les cartes). */}
          {price && plan.id !== "custom" && period === "yearly" && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Crédits inclus par mois</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight">
                  <AnimatedNumber value={sliderValue} format={(n) => n.toLocaleString("fr-FR")} />
                </p>
              </div>
              <ul className="divide-y divide-border/60 text-sm">
                {videoRows.map((r) => (
                  <li key={r.model} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="font-medium">{r.label}</span>
                    <span className="text-muted-foreground">
                      jusqu'à <span className="font-semibold text-foreground">{r.count}</span> vidéos · {r.resolution}
                    </span>
                  </li>
                ))}
              </ul>
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
              <ul className="divide-y divide-border/60 text-sm">
                {videoRows.map((r) => (
                  <li key={r.model} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="font-medium">{r.label}</span>
                    <span className="text-muted-foreground">
                      jusqu'à <span className="font-semibold text-foreground">{r.count}</span> vidéos · {r.resolution}
                    </span>
                  </li>
                ))}
              </ul>
              {unitCustom !== null && selectedCountry && (
                <p className="text-xs text-muted-foreground">
                  Prix : {formatLocalAmount(unitCustom, selectedCountry.currency)} par crédit
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
          {(showFeatures || plan.id !== "custom") && (() => {
            const all = featuresFor(plan, sliderValue, Number(price?.credits_bonus ?? 0), price?.images_free ?? null);
            const cut = all.findIndex((f) => f.title === "Clonage vidéo");
            const limit = plan.id === "custom" || expanded || cut < 0 ? all.length : cut + 1;
            return (
              <>
                {all.slice(0, limit).map((f, i) => (
              <div
                key={f.title}
                style={{ animationDelay: `${i * 80}ms` }}
                className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15">
                  <f.icon className="h-3.5 w-3.5 text-primary" />
                </span>
                <span className="min-w-0 flex-1 text-[14px] font-medium leading-snug">
                  {f.title}
                  {f.sub && f.sub !== "Bientôt disponible" && (
                    <span className="block text-xs font-normal text-muted-foreground">{f.sub}</span>
                  )}
                </span>
                {(f.soon || f.sub === "Bientôt disponible") && (
                  <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                    Bientôt disponible
                  </span>
                )}
              </div>
                ))}
                {limit < all.length && (
                  <button type="button" onClick={() => setExpanded(true)} className="w-full text-left text-sm font-medium text-primary">
                    Voir plus ({all.length - limit})
                  </button>
                )}
                {expanded && plan.id !== "custom" && (
                  <button type="button" onClick={() => setExpanded(false)} className="w-full text-left text-sm font-medium text-primary">
                    Voir moins
                  </button>
                )}
              </>
            );
          })()}
        </div>

        {plan.id !== "custom" && (
          <button
            type="button"
            onClick={() => setActive("custom")}
            className="mt-4 w-full rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-left text-sm font-medium text-primary"
          >
            Besoin de plus ? Achetez le nombre de crédits que vous voulez avec « Sur mesure ».
          </button>
        )}

        {/* Code promo */}
        <div className="mt-4 space-y-2">
          {false ? (
            <button
              type="button"
              onClick={() => setPromoOpen(true)}
              className="mx-auto block text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
            >
              J'ai un code promo
            </button>
          ) : (
            <div className="flex gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
              <input
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                placeholder="EX : BIENVENUE20"
                className="flex-1 rounded-xl border-0 bg-secondary/60 px-3 py-2.5 uppercase"
              />
              <button
                type="button"
                onClick={applyPromo}
                className="rounded-xl bg-secondary px-4 py-2 text-sm font-medium"
              >
                Appliquer
              </button>
            </div>
          )}
          {promoApplied && quote && quote.discountEur > 0 && (
            <p className="text-sm text-primary">Code {promoApplied} appliqué : −{quote.discountPercent ?? 0} %</p>
          )}
          {promoError && <p className="text-sm text-destructive">{promoError}</p>}
        </div>

        {/* Prix total */}
        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            {period === "yearly" && yearly ? "Total pour 12 mois" : "Total par mois"}
          </p>
          {quote && (
            <p className="mt-2 text-sm text-muted-foreground">
              Sous-total {formatLocalAmount(Math.round(quote.amountLocal / 1.025), quote.currency)} · frais de paiement 2,5 % :{" "}
              {formatLocalAmount(quote.amountLocal - Math.round(quote.amountLocal / 1.025), quote.currency)}
            </p>
          )}
          <p className="mt-1 text-3xl font-semibold tracking-tight">
            {quoteBusy && !quote
              ? "…"
              : quote
                ? <AnimatedNumber value={quote.amountLocal} format={(n) => formatLocalAmount(n, quote.currency)} />
                : pricesLoaded
                  ? "Indisponible"
                  : "…"}
          </p>
        </div>
        {viewDetail && <CheckoutFeedback />}

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

        <div className="mt-6 rounded-2xl border border-border bg-card/60 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Vos crédits</span>
            <span className="text-lg font-semibold">{profile?.credits_balance ?? 0}</span>
          </div>
          <a href="/tableau-de-bord" className="mt-4 block text-center text-sm font-medium text-primary">
            Voir mon tableau de bord
          </a>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Conditions d'utilisation · Politique de confidentialité
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">Sam flash 2.0 — Studio IA</p>
      </div>
    </div>
  );
}
