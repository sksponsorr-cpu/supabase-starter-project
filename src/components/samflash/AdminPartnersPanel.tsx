import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminPartnerOverview,
  adminResolvePartnerWithdrawal,
  adminListPartnerApplications,
  adminReviewPartnerApplication,
  type AdminPartnerOverview,
  type AdminApplication,
} from "@/lib/partner.functions";
import { formatLocalAmount, findCountry } from "@/lib/payments/countries";

const card = "rounded-2xl border border-border p-4 space-y-3";
const btn = "rounded-full px-4 py-2 text-xs font-semibold transition-all duration-500 ease-out hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-40";

/** Bureau admin : demandes d'adhésion, évolution des parrains et retraits à traiter. */
export function AdminPartnersPanel() {
  const fetchOverview = useServerFn(adminPartnerOverview);
  const resolve = useServerFn(adminResolvePartnerWithdrawal);
  const fetchApps = useServerFn(adminListPartnerApplications);
  const reviewApp = useServerFn(adminReviewPartnerApplication);

  const [data, setData] = useState<AdminPartnerOverview | null>(null);
  const [apps, setApps] = useState<AdminApplication[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = () =>
    Promise.all([fetchOverview(), fetchApps()])
      .then(([d, a]) => {
        setData(d);
        setApps(a);
      })
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (id: string, action: "verse" | "refuse") => {
    setBusy(id);
    await resolve({ data: { id, action } }).catch(() => null);
    await reload();
    setBusy(null);
  };

  const review = async (id: string, action: "approuve" | "refuse") => {
    setBusy(id);
    await reviewApp({ data: { id, action } }).catch(() => null);
    await reload();
    setBusy(null);
  };

  if (error) return <p className="text-sm text-muted-foreground">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Chargement des partenaires…</p>;

  const pendingApps = apps.filter((a) => a.status === "en_attente");

  return (
    <section className={card}>
      <h3 className="text-base font-semibold">Partenaires</h3>

      <div className="space-y-2">
        <p className="text-sm font-medium">Demandes d'adhésion ({pendingApps.length} en attente)</p>
        {pendingApps.length === 0 && <p className="text-sm text-muted-foreground">Aucune demande en attente.</p>}
        {pendingApps.map((a) => (
          <div key={a.id} className="space-y-2 rounded-xl bg-secondary/40 px-3 py-2 text-sm">
            <p className="font-medium">
              {a.fullName} · {findCountry(a.countryCode)?.name ?? a.countryCode}
            </p>
            <p className="text-xs text-muted-foreground">
              {a.email} · {a.phone}
            </p>
            <p className="text-xs">{a.channels}</p>
            {a.audience && <p className="text-xs text-muted-foreground">Audience : {a.audience}</p>}
            <div className="flex gap-2">
              <button className={`${btn} bg-primary text-primary-foreground`} disabled={busy === a.id} onClick={() => void review(a.id, "approuve")}>
                Approuver
              </button>
              <button className={`${btn} bg-secondary`} disabled={busy === a.id} onClick={() => void review(a.id, "refuse")}>
                Refuser
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Demandes de retrait ({data.pendingWithdrawals.length})</p>
        {data.pendingWithdrawals.length === 0 && <p className="text-sm text-muted-foreground">Aucune demande en attente.</p>}
        {data.pendingWithdrawals.map((w) => (
          <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/40 px-3 py-2 text-sm">
            <div>
              <p className="font-medium">
                {w.code} · {formatLocalAmount(w.amountLocal, w.currency)}
              </p>
              <p className="text-xs text-muted-foreground">
                {w.method} · {w.mobile} · {w.amountEur.toFixed(2)} € net
              </p>
            </div>
            <div className="flex gap-2">
              <button className={`${btn} bg-primary text-primary-foreground`} disabled={busy === w.id} onClick={() => void act(w.id, "verse")}>
                Marquer versé
              </button>
              <button className={`${btn} bg-secondary`} disabled={busy === w.id} onClick={() => void act(w.id, "refuse")}>
                Refuser
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Évolution des parrains</p>
        {data.partners.length === 0 && <p className="text-sm text-muted-foreground">Aucun parrain pour le moment.</p>}
        {data.partners.map((p) => (
          <div key={p.userId} className="grid grid-cols-5 gap-2 rounded-xl px-3 py-2 text-xs tabular-nums">
            <span className="font-medium">{p.code}</span>
            <span>{p.signups} insc.</span>
            <span>{p.conversions} achats</span>
            <span>{p.available.toFixed(2)} € dispo</span>
            <span>{p.paid.toFixed(2)} € versé</span>
          </div>
        ))}
      </div>
    </section>
  );
}
