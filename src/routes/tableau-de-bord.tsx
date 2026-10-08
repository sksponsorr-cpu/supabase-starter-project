import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { creditCostFor } from "@/lib/credits";
import { PLAN_LABEL, toPlanType } from "@/lib/plans";

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

const KIND_LABEL: Record<string, string> = {
  abonnement: "Abonnement",
  annuel_mensuel: "Crédits mensuels (annuel)",
  recharge: "Recharge",
  pass: "Pass 7 jours",
  generation: "Génération",
  remboursement: "Remboursement (génération échouée)",
  admin: "Ajustement",
};

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
  const endsLabel = sub?.ends_at ? new Date(sub.ends_at).toLocaleDateString("fr-FR") : null;

  return (
    <main className="min-h-screen bg-background px-5 pb-12 pt-6 text-foreground">
      <div className="mx-auto max-w-xl space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Mon tableau de bord</h1>
          <a href="/app" className="rounded-full bg-secondary px-4 py-2 text-sm font-medium">
            Retour
          </a>
        </div>

        <section className="rounded-2xl border border-primary/40 bg-primary/10 p-5">
          <p className="text-sm text-muted-foreground">Solde de crédits</p>
          <p className="mt-1 text-4xl font-semibold">{balance === null ? "…" : balance}</p>
        </section>

        <section className="rounded-2xl border border-border bg-card/50 p-5">
          <p className="text-sm text-muted-foreground">Abonnement</p>
          {subActive && sub ? (
            <>
              <p className="mt-1 text-lg font-semibold">{PLAN_LABEL[toPlanType(sub.plan_type)]}</p>
              {endsLabel && <p className="mt-1 text-sm text-muted-foreground">Valable jusqu'au {endsLabel}</p>}
            </>
          ) : (
            <p className="mt-1 text-lg font-semibold">Aucun abonnement actif</p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card/50 p-5">
          <p className="text-sm font-medium">Coût des générations</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between"><span>Image 480p</span><span>{creditCostFor("image", 0, "480p")} crédit</span></li>
            <li className="flex justify-between"><span>Image 720p</span><span>{creditCostFor("image", 0, "720p")} crédits</span></li>
            <li className="flex justify-between"><span>Image 1080p</span><span>{creditCostFor("image", 0, "1080p")} crédits</span></li>
            <li className="flex justify-between"><span>Vidéo 5 s en 480p</span><span>{creditCostFor("video", 5, "480p")} crédits</span></li>
            <li className="flex justify-between"><span>Vidéo 5 s en 720p</span><span>{creditCostFor("video", 5, "720p")} crédits</span></li>
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-card/50 p-5">
          <p className="text-sm font-medium">Historique</p>
          {ledger === null ? (
            <p className="mt-3 text-sm text-muted-foreground">Chargement…</p>
          ) : ledger.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Aucun mouvement pour l'instant.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {ledger.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span>
                    <span className="block font-medium">{KIND_LABEL[row.kind] ?? row.kind}</span>
                    <span className="block text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleString("fr-FR")}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className={`block font-semibold ${row.delta >= 0 ? "text-primary" : ""}`}>
                      {row.delta >= 0 ? "+" : ""}
                      {row.delta}
                    </span>
                    <span className="block text-xs text-muted-foreground">solde : {row.balance_after}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
