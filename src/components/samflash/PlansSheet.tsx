import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listPrices, type PriceRow } from "@/lib/payments.functions";
import { supabase } from "@/integrations/supabase/client";
import { activatePromoOffer, getPromoSettings, PROMO_DAYS } from "@/lib/promo.functions";
import { toast } from "@/lib/toast";
import { CheckoutSheet } from "@/components/samflash/CheckoutSheet";
import {
  X,
  Zap,
  Sparkles,
  Rocket,
  FolderPlus,
  MonitorPlay,
  Brain,
  Infinity as InfinityIcon,
  Check,
} from "lucide-react";
import nightSky from "@/assets/night-sky.jpg";
import { useAuth } from "@/hooks/useAuth";
import { creditCostFor, OFFER_END_ISO } from "@/lib/credits";

type PlanId = "base" | "plus" | "heavy";

type Plan = {
  id: PlanId;
  label: string;
  badge?: string;
  tagline: React.ReactNode;
  features: { icon: React.ElementType; title: string; sub?: string }[];
  monthly: string;
  monthlyNote?: string;
  yearly?: { price: string; perMonth: string };
  cta: string;
  footnote: string;
};

const PLANS: Plan[] = [
  {
    id: "base",
    label: "Super grok",
    tagline: <>Créez sans limite avec Super grok</>,
    features: [
      {
        icon: Sparkles,
        title: "Créez des images et des vidéos IA époustouflantes",
        sub: "Avec des vidéos HD 720p de 6 secondes",
      },
      { icon: FolderPlus, title: "Importez plus de fichiers pour des réponses plus pertinentes" },
      { icon: Zap, title: "Des réponses fulgurantes" },
    ],
    monthly: "35 € /mois",
    yearly: { price: "349 € /an", perMonth: "29,08 € /mois" },
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
    monthly: "79 € /mois",
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
    monthly: "349 € /mois",
    cta: "Passer à Super grok heavy",
    footnote: "Facturation mensuelle, annulez à tout moment",
  },
];


function OfferCountdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = new Date(OFFER_END_ISO).getTime() - now;
  if (diff <= 0) {
    return (
      <div className="rounded-2xl border border-border bg-card/60 p-3 text-center">
        <p className="text-sm font-medium">L'offre de lancement est terminée.</p>
        <p className="mt-1 text-xs text-muted-foreground">Les prix vont augmenter.</p>
      </div>
    );
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor(diff / 3_600_000) % 24;
  const minutes = Math.floor(diff / 60_000) % 60;
  const seconds = Math.floor(diff / 1000) % 60;

  return (
    <div className="rounded-2xl border border-primary/40 bg-primary/10 p-3 text-center">
      <p className="text-xs text-muted-foreground">Offre de lancement : fin dans</p>
      <p className="mt-1 font-mono text-lg font-semibold">
        {days}j {pad(hours)}h {pad(minutes)}m {pad(seconds)}s
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Ensuite, les prix vont augmenter.</p>
    </div>
  );
}

export function PlansSheet({ onClose }: { onClose: () => void }) {
  const [active, setActive] = useState<PlanId>("base");
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [notice] = useState<string | null>(null);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [pricesLoaded, setPricesLoaded] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [promo, setPromo] = useState<{ enabled: boolean; prices: Record<string, number | null> }>({
    enabled: false,
    prices: {},
  });
  const [activating, setActivating] = useState(false);
  const [packId, setPackId] = useState<string | null>(null);
  const { profile, user } = useAuth();
  const [isSubscriber, setIsSubscriber] = useState(false);

  // Crédits affichés uniquement aux abonnés
  useEffect(() => {
    if (!user) return;
    void supabase
      .from("subscriptions")
      .select("is_active, ends_at")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setIsSubscriber(Boolean(data?.is_active) && (!data?.ends_at || new Date(data.ends_at) > new Date()));
      });
  }, [user]);
  const packs = prices.filter((p) => p.tier === "credits");
  const fetchPrices = useServerFn(listPrices);
  const fetchPromo = useServerFn(getPromoSettings);
  const activatePromo = useServerFn(activatePromoOffer);
  const plan = PLANS.find((p) => p.id === active)!;
  const price = prices.find((p) => p.id === active);

  useEffect(() => {
    setPeriod("monthly");
  }, [active]);

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

    // Tout changement de tarif dans le bureau d'administration arrive ici en direct.
    const channel = supabase
      .channel("product_prices_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "product_prices" }, () => {
        void refresh();
      })
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [fetchPrices]);

  useEffect(() => {
    fetchPromo({})
      .then((p) => setPromo(p))
      .catch(() => setPromo({ enabled: false, prices: {} }));
  }, [fetchPromo]);

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

  // Aucun prix « de secours » n'est affiché avant le chargement : cela évitait
  // de montrer l'ancien tarif puis de basculer sur le nouveau.
  // Crédits reçus par mois, calculés comme côté base (taux x prix, + bonus)
  const monthlyCredits = price
    ? period === "yearly" && price.amount_eur_yearly !== null
      ? Math.round((price.amount_eur_yearly / 12) * (price.credits_rate ?? 0)) + price.credits_bonus
      : (price.credits_fixed ?? Math.round(price.amount_eur * (price.credits_rate ?? 0)) + price.credits_bonus)
    : null;
  const basePriceLabel = price
    ? `${price.amount_eur.toFixed(2)} € /mois`
    : pricesLoaded
      ? plan.monthly
      : "…";
  const monthlyLabel =
    promoAmount !== null
      ? promoAmount === 0
        ? "GRATUIT"
        : `${promoAmount.toFixed(2)} € /mois`
      : basePriceLabel;
  const yearlyAmount = price?.amount_eur_yearly ?? null;
  const yearlyLabel =
    yearlyAmount !== null ? `${yearlyAmount.toFixed(2)} € /an` : pricesLoaded ? plan.yearly?.price : "…";
  const yearlyPerMonth =
    yearlyAmount !== null
      ? `${(yearlyAmount / 12).toFixed(2)} € /mois`
      : pricesLoaded
        ? plan.yearly?.perMonth
        : "";
  const hasYearly = yearlyAmount !== null || Boolean(plan.yearly);

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
              <span className="rounded-xl bg-secondary px-3 py-1 text-lg font-medium">
                {plan.badge}
              </span>
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
                active === p.id
                  ? "bg-secondary text-foreground shadow-[var(--shadow-glow)]"
                  : "text-muted-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3 rounded-2xl border border-border bg-card/50 p-4 backdrop-blur-xl">
          <OfferCountdown />

          {monthlyCredits !== null && monthlyCredits > 0 && (
            <div className="rounded-2xl border border-primary/40 bg-primary/10 p-3">
              <p className="text-xl font-semibold">{monthlyCredits.toLocaleString("fr-FR")} crédits / mois</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Image : {creditCostFor("image", 0, "480p")} à {creditCostFor("image", 0, "1080p")} crédits selon la qualité · Vidéo : {creditCostFor("video", 1, "480p")} crédit par seconde en 480p, {creditCostFor("video", 1, "720p")} en 720p
                {period === "yearly" ? " · payé une fois, crédités chaque mois pendant 12 mois" : ""}
              </p>
            </div>
          )}

          {plan.features.map((f) => (
            <div key={f.title} className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                <f.icon className="h-4 w-4 text-foreground" />
              </span>
              <span className="text-[15px] font-medium leading-snug">{f.title}</span>
            </div>
          ))}
        </div>

        <div className="mt-4">
          {hasYearly ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPeriod("monthly")}
                className={`rounded-2xl border p-4 text-left ${
                  period === "monthly" ? "border-primary bg-secondary/60" : "border-border bg-card/40"
                }`}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">Mensuel</span>
                  {promoAmount !== null ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-primary-foreground">
                      Promo lancement
                    </span>
                  ) : (
                    plan.monthlyNote && (
                      <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
                        {plan.monthlyNote}
                      </span>
                    )
                  )}
                </span>
                {promoAmount !== null && (
                  <span className="mt-2 block text-sm text-muted-foreground line-through">
                    {basePriceLabel}
                  </span>
                )}
                <span
                  className={`block font-semibold ${
                    promoFree ? "text-3xl text-primary" : "mt-2 text-2xl"
                  }`}
                >
                  {monthlyLabel}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPeriod("yearly")}
                className={`rounded-2xl border p-4 text-left ${
                  period === "yearly" ? "border-primary bg-secondary/60" : "border-border bg-card/40"
                }`}
              >
                <span className="text-muted-foreground">Annuel</span>
                <span className="mt-2 block text-2xl font-semibold">{yearlyLabel}</span>
                <span className="block text-sm text-muted-foreground">{yearlyPerMonth}</span>
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card/40 p-4">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">Mensuel</span>
                {promoAmount !== null && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-primary-foreground">
                    Promo lancement
                  </span>
                )}
              </span>
              {promoAmount !== null && (
                <span className="mt-1 block text-sm text-muted-foreground line-through">
                  {basePriceLabel}
                </span>
              )}
              <span
                className={`mt-1 block text-3xl font-semibold ${promoFree ? "text-primary" : ""}`}
              >
                {monthlyLabel}
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={activating}
          onClick={() => (promoFree ? void claimPromo() : setCheckoutOpen(true))}
          className="mt-6 w-full rounded-full bg-foreground py-4 text-[17px] font-semibold text-background transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {activating
            ? "Activation…"
            : promoFree
              ? "Activer l'offre de lancement (offerte)"
              : plan.cta}
        </button>

        {checkoutOpen && (
          <CheckoutSheet
            productId={active}
            productLabel={price?.label ?? plan.label}
            period={period}
            onClose={() => setCheckoutOpen(false)}
          />
        )}

        <p className="mt-3 text-center text-sm text-muted-foreground">
          {promoFree
            ? `Offre de lancement : ${PROMO_DAYS} jours offerts, sans paiement.`
            : plan.footnote}
        </p>
        {notice && <p className="mt-2 text-center text-sm text-primary">{notice}</p>}

        <div className="mt-8 rounded-2xl border border-border bg-card/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Vos crédits</span>
            <span className="text-lg font-semibold">{profile?.credits_balance ?? 0}</span>
          </div>
          {packs.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Recharger</p>
              {packs.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setPackId(pack.id)}
                  className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left"
                >
                  <span>{pack.label}</span>
                  <span className="font-semibold">{pack.amount_eur.toFixed(2)} €</span>
                </button>
              ))}
            </div>
          )}
          <a href="/tableau-de-bord" className="mt-4 block text-center text-sm font-medium text-primary">
            Voir mon tableau de bord
          </a>
        </div>

        {packId && (
          <CheckoutSheet
            productId={packId}
            productLabel={prices.find((p) => p.id === packId)?.label ?? "Recharge"}
            onClose={() => setPackId(null)}
          />
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Conditions d'utilisation · Politique de confidentialité · Restaurer les achats
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Sam flash 2.0 — Studio IA
        </p>
      </div>
    </div>
  );
}
