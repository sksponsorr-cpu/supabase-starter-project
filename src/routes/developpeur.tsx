import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Wallet, Loader2, Send } from "lucide-react";
import {
  getDeveloperDashboard,
  requestPayout,
  type DeveloperDashboard,
} from "@/lib/developer.functions";
import { toast } from "@/lib/toast";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/developpeur")({
  head: () => ({
    meta: [
      { title: "Espace développeur — Sam flash 2.0" },
      {
        name: "description",
        content:
          "Solde, commissions de 20 % sur les paiements et demandes de versement pour l'équipe de développeurs de Sam flash 2.0.",
      },
      { property: "og:title", content: "Espace développeur — Sam flash 2.0" },
      {
        property: "og:description",
        content: "Suivi des commissions et demandes de versement des développeurs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DeveloperPage,
});

const euro = (n: number) => `${n.toFixed(2)} €`;

function DeveloperPage() {
  const { session, loading: authLoading } = useAuth();
  const load = useServerFn(getDeveloperDashboard);
  const ask = useServerFn(requestPayout);

  const [data, setData] = useState<DeveloperDashboard | null>(null);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("");
  const [mobile, setMobile] = useState("");
  const [note, setNote] = useState("");

  const refresh = useCallback(async () => {
    try {
      setData(await load({}));
    } catch {
      setData(null);
    }
  }, [load]);

  useEffect(() => {
    if (session) void refresh();
  }, [session, refresh]);

  const submit = useCallback(async () => {
    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Montant invalide.");
      return;
    }
    setBusy(true);
    try {
      const res = await ask({
        data: { amountEur: value, method: "mobile_money", mobile, note: note || undefined },
      });
      if (res.ok) {
        toast.success(res.message);
        setAmount("");
        setNote("");
        await refresh();
      } else toast.error(res.message);
    } catch {
      toast.error("Demande impossible.");
    } finally {
      setBusy(false);
    }
  }, [amount, mobile, note, ask, refresh]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-muted-foreground">Connectez-vous pour accéder à votre espace.</p>
        <Link to="/" className="rounded-full bg-primary px-5 py-2 text-primary-foreground">
          Retour à l'accueil
        </Link>
      </div>
    );
  }

  if (data && !data.isDeveloper) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-muted-foreground">Cet espace est réservé à l'équipe de développeurs.</p>
        <Link to="/" className="rounded-full bg-primary px-5 py-2 text-primary-foreground">
          Retour à l'accueil
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Link to="/" aria-label="Retour" className="rounded-full p-2 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <Wallet className="h-5 w-5 text-primary" /> Espace développeur
        </h1>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-4">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Solde disponible", value: data?.balance ?? 0 },
            { label: "Total gagné", value: data?.totalEarned ?? 0 },
            { label: "En attente", value: data?.pending ?? 0 },
            { label: "Déjà versé", value: data?.totalPaid ?? 0 },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-xl font-semibold">{euro(c.value)}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 font-medium">Demander un versement</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="Montant en euros"
              className="rounded-xl border border-border bg-background px-3 py-2"
            />
            <input
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              inputMode="tel"
              placeholder="Numéro Mobile Money"
              className="rounded-xl border border-border bg-background px-3 py-2"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Message (facultatif)"
              className="rounded-xl border border-border bg-background px-3 py-2 sm:col-span-2"
            />
          </div>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || mobile.trim().length < 6}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envoyer la demande
          </button>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 font-medium">Mes demandes</h2>
          {(data?.payouts ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune demande pour le moment.</p>
          ) : (
            <ul className="space-y-2">
              {(data?.payouts ?? []).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <span>
                    {euro(Number(p.amount_eur))} — {new Date(p.created_at).toLocaleDateString("fr-FR")}
                  </span>
                  <span className="text-muted-foreground">{p.status.replace("_", " ")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 font-medium">Dernières commissions</h2>
          {(data?.earnings ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Chaque paiement réussi vous crédite automatiquement 20 % du montant.
            </p>
          ) : (
            <ul className="space-y-2">
              {(data?.earnings ?? []).slice(0, 30).map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <span>{new Date(e.created_at).toLocaleString("fr-FR")}</span>
                  <span className="font-medium">{euro(Number(e.amount_eur))}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
