import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Coins,
  CreditCard,
  Gift,
  ImageIcon,
  Infinity as InfinityIcon,
  RotateCcw,
  Sparkles,
  Video,
  Wallet,
  Zap,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { creditCostFor } from "@/lib/credits";
import { samCreditsFor } from "@/lib/creator-pricing";
import { PLAN_LABEL, toPlanType } from "@/lib/plans";
import nightSky from "@/assets/night-sky.jpg";

export const Route = createFileRoute("/tableau-de-bord")({
  head: () => ({ meta: [{ title: "Tableau de bord – Sam Flash 2.0" }] }),
  component: TableauDeBordPage,
});

type LedgerRow = {
  id: string;
  delta: number;
  balance_after: number;
  kind: string;
  created_at: string;
};

type SubRow = { plan_type: string | null; ends_at: string | null; is_active: boolean | null };

const KIND_META: Record<string, { label: string; icon: React.ElementType }> = {
  abonnement: { label: "Abonnement", icon: Sparkles },
  annuel_mensuel: { label: "Crédits mensuels (annuel)", icon: Sparkles },
  recharge: { label: "Recharge", icon: CreditCard },
  pass: { label: "Pass 7 jours", icon: Zap },
  generation: { label: "Génération", icon: Video },
  remboursement: { label: "Remboursement", icon: RotateCcw },
  admin: { label: "Ajustement", icon: Gift },
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TableauDeBordPage() {
  const navigate = useNavigate();
  const { session, user, loading } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [sub, setSub] = useState<SubRow | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("credits_balance")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setBalance(data?.credits_balance ?? 0));
    void supabase
      .from("subscriptions")
      .select("plan_type, ends_at, is_active")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setSub(data ?? null));
    void supabase
      .from("credit_ledger")
      .select("id, delta, balance_after, kind, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setLedger(data ?? []));
  }, [user]);

  const subActive = !!sub && sub.is_active === true && (!sub.ends_at || new Date(sub.ends_at) > new Date());

  const stats = useMemo(() => {
    if (!ledger) return null;
    const spent = ledger.filter((r) => r.delta < 0).reduce((total, r) => total + Math.abs(r.delta), 0);
    const earned = ledger.filter((r) => r.delta > 0).reduce((total, r) => total + r.delta, 0);
    return { spent, earned };
  }, [ledger]);

  const costs = [
    { icon: ImageIcon, label: "Image 480p", value: creditCostFor("image", 0, "480p") },
    { icon: ImageIcon, label: "Image 720p", value: creditCostFor("image", 0, "720p") },
    { icon: ImageIcon, label: "Image 1080p", value: creditCostFor("image", 0, "1080p") },
    { icon: Video, label: "Grok Imagine · 480p", value: samCreditsFor("grok-imagine", "480p", 6) ?? 0 },
    { icon: Video, label: "Seedance 2.0 · 720p", value: samCreditsFor("seedance-2", "720p", 5) ?? 0 },
    { icon: Video, label: "Seedance 2.5 · 720p", value: samCreditsFor("seedance-2-5", "720p", 5) ?? 0 },
    { icon: Video, label: "Veo 3.1 · 1080p", value: samCreditsFor("veo-3-1", "1080p", 8, "fast") ?? 0 },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-60"
        style={{
          backgroundImage: `linear-gradient(to bottom, transparent, var(--background)), url(${nightSky})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      <div className="relative mx-auto max-w-2xl space-y-6 px-5 pb-16 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)]">
        {/* En-tête */}
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Sam flash</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Tableau de bord</h1>
          </div>
          <Link
            to="/app"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm font-medium backdrop-blur-xl transition-colors hover:bg-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
        </header>

        {/* Solde */}
        <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/25 via-card/70 to-background p-6 shadow-[var(--shadow-glow)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Solde de crédits</p>
              <p className="mt-2 text-5xl font-semibold tabular-nums tracking-tight">
                {balance === null ? <span className="text-muted-foreground">…</span> : balance.toLocaleString("fr-FR")}
              </p>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 text-primary">
              <Wallet className="h-6 w-6" />
            </span>
          </div>
          {stats && (
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-background/50 p-3">
                <p className="text-xs text-muted-foreground">Crédits reçus</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-primary">+{stats.earned}</p>
              </div>
              <div className="rounded-2xl bg-background/50 p-3">
                <p className="text-xs text-muted-foreground">Crédits utilisés</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">−{stats.spent}</p>
              </div>
            </div>
          )}
        </section>

        {/* Abonnement */}
        <section className="flex items-center gap-4 rounded-3xl border border-border bg-card/60 p-5 backdrop-blur-xl">
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              subActive ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
            }`}
          >
            {subActive ? <Sparkles className="h-6 w-6" /> : <InfinityIcon className="h-6 w-6" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">Abonnement</p>
            {subActive && sub ? (
              <>
                <p className="truncate text-lg font-semibold">{PLAN_LABEL[toPlanType(sub.plan_type)]}</p>
                {sub.ends_at && (
                  <p className="text-sm text-muted-foreground">Valable jusqu'au {formatDate(sub.ends_at)}</p>
                )}
              </>
            ) : (
              <>
                <p className="text-lg font-semibold">Aucun abonnement actif</p>
                <p className="text-sm text-muted-foreground">Passez à un forfait pour recevoir des crédits chaque mois.</p>
              </>
            )}
          </div>
          {!subActive && (
            <Link
              to="/app"
              className="shrink-0 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform active:scale-95"
            >
              Voir les offres
            </Link>
          )}
        </section>

        {/* Coût des générations */}
        <section>
          <h2 className="mb-3 px-1 text-sm font-semibold text-muted-foreground">Coût des générations</h2>
          <div className="grid grid-cols-2 gap-3">
            {costs.map((c) => (
              <div
                key={c.label}
                className="flex flex-col justify-between rounded-2xl border border-border bg-card/50 p-4 backdrop-blur-xl"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground">
                  <c.icon className="h-4 w-4" />
                </span>
                <p className="mt-4 text-sm text-muted-foreground">{c.label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {c.value} <span className="text-sm font-medium text-muted-foreground">{c.value > 1 ? "crédits" : "crédit"}</span>
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Historique */}
        <section className="rounded-3xl border border-border bg-card/50 p-5 backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-muted-foreground">Historique</h2>
            {ledger && ledger.length > 0 && <span className="text-xs text-muted-foreground">{ledger.length} derniers mouvements</span>}
          </div>

          {ledger === null ? (
            <div className="space-y-3 py-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-2xl bg-secondary/60" />
              ))}
            </div>
          ) : ledger.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
                <Coins className="h-6 w-6 text-muted-foreground" />
              </span>
              <p className="text-sm text-muted-foreground">Aucun mouvement pour l'instant.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {ledger.map((row) => {
                const meta = KIND_META[row.kind] ?? { label: row.kind, icon: Coins };
                const positive = row.delta >= 0;
                return (
                  <li key={row.id} className="flex items-center gap-3 py-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        positive ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      <meta.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(row.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold tabular-nums ${positive ? "text-primary" : ""}`}>
                        {positive ? "+" : "−"}
                        {Math.abs(row.delta)}
                      </p>
                      <p className="text-xs tabular-nums text-muted-foreground">solde {row.balance_after}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
