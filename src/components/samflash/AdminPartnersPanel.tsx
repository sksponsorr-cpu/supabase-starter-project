import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminPartnerOverview,
  adminResolvePartnerWithdrawal,
  adminListPartnerApplications,
  adminReviewPartnerApplication,
  adminAddPartner,
  type AdminPartnerOverview,
  type AdminApplication,
} from "@/lib/partner.functions";
import { formatLocalAmount, findCountry } from "@/lib/payments/countries";

const card = "rounded-3xl border border-border bg-card/50 p-5 space-y-5 backdrop-blur-xl";
const field = "w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition-all duration-300 focus:border-primary/60";
const btn = "rounded-full px-4 py-2 text-xs font-semibold transition-all duration-500 ease-out hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-40";
const sectionTitle = "text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground";

/** Bureau admin : ajout direct de partenaires, demandes d'adhésion, retraits et évolution des parrains. */
export function AdminPartnersPanel() {
  const fetchOverview = useServerFn(adminPartnerOverview);
  const resolve = useServerFn(adminResolvePartnerWithdrawal);
  const fetchApps = useServerFn(adminListPartnerApplications);
  const reviewApp = useServerFn(adminReviewPartnerApplication);
  const addPartner = useServerFn(adminAddPartner);

  const [data, setData] = useState<AdminPartnerOverview | null>(null);
  const [apps, setApps] = useState<AdminApplication[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [addEmail, setAddEmail] = useState("");
  const [addLink, setAddLink] = useState("");

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
    setNotice(null);
    const res = await reviewApp({ data: { id, action } }).catch(() => ({ ok: false, message: "Erreur réseau." }));
    setNotice(res.message);
    await reload();
    setBusy(null);
  };

  const onAdd = async () => {
    setBusy("add");
    setNotice(null);
    const res = await addPartner({ data: { email: addEmail, link: addLink } }).catch(() => ({ ok: false, message: "Erreur réseau." }));
    setNotice(res.message);
    if (res.ok) {
      setAddEmail("");
      setAddLink("");
    }
    await reload();
    setBusy(null);
  };

  if (error) return <p className="text-sm text-muted-foreground">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Chargement des partenaires…</p>;

  const pendingApps = apps.filter((a) => a.status === "en_attente");

  return (
    <section className={card}>
      <div>
        <h3 className="text-lg font-semibold tracking-tight">Partenaires</h3>
        <p className="text-xs text-muted-foreground">Ajoutez un partenaire déjà inscrit, ou traitez les demandes.</p>
      </div>

      {notice && <p className="rounded-2xl bg-primary/10 px-4 py-3 text-sm">{notice}</p>}

      {/* Ajout direct */}
      <div className="space-y-3 rounded-2xl border border-border p-4">
        <p className={sectionTitle}>Ajouter un partenaire</p>
        <input className={field} type="email" placeholder="E-mail du compte inscrit" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} />
        <input className={field} placeholder="Son lien affilié (https://sam-flash.lat/?ref=…)" value={addLink} onChange={(e) => setAddLink(e.target.value)} />
        <button
          type="button"
          className={`${btn} bg-primary text-primary-foreground`}
          disabled={busy === "add" || !addEmail.includes("@") || addLink.trim().length < 5}
          onClick={() => void onAdd()}
        >
          {busy === "add" ? "Ajout…" : "Ajouter et envoyer le lien par e-mail"}
        </button>
      </div>

      {/* Demandes */}
      <div className="space-y-3">
        <p className={sectionTitle}>Demandes d'adhésion ({pendingApps.length})</p>
        {pendingApps.length === 0 && <p className="text-sm text-muted-foreground">Aucune demande en attente.</p>}
        {pendingApps.map((a) => (
          <div key={a.id} className="space-y-3 rounded-2xl border border-border p-4">
            <div>
              <p className="font-semibold">{a.fullName}</p>
              <p className="text-xs text-muted-foreground">
                {findCountry(a.countryCode)?.name ?? a.countryCode} · {a.email} · {a.phone}
              </p>
            </div>
            <p className="whitespace-pre-line break-all text-xs">{a.channels}</p>
            {a.audience && <p className="text-xs text-muted-foreground">Audience : {a.audience}</p>}
            <div className="flex gap-2">
              <button className={`${btn} bg-primary text-primary-foreground`} disabled={busy === a.id} onClick={() => void review(a.id, "approuve")}>
                Approuver et envoyer le lien
              </button>
              <button className={`${btn} bg-secondary`} disabled={busy === a.id} onClick={() => void review(a.id, "refuse")}>
                Refuser
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Retraits */}
      <div className="space-y-3">
        <p className={sectionTitle}>Demandes de retrait ({data.pendingWithdrawals.length})</p>
        {data.pendingWithdrawals.length === 0 && <p className="text-sm text-muted-foreground">Aucune demande en attente.</p>}
        {data.pendingWithdrawals.map((w) => (
          <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4 text-sm">
            <div>
              <p className="font-semibold">{formatLocalAmount(w.amountLocal, w.currency)}</p>
              <p className="text-xs text-muted-foreground">{w.method} · {w.mobile} · {w.amountEur.toFixed(2)} € net</p>
            </div>
            <div className="flex gap-2">
              <button className={`${btn} bg-primary text-primary-foreground`} disabled={busy === w.id} onClick={() => void act(w.id, "verse")}>Marquer versé</button>
              <button className={`${btn} bg-secondary`} disabled={busy === w.id} onClick={() => void act(w.id, "refuse")}>Refuser</button>
            </div>
          </div>
        ))}
      </div>

      {/* Évolution */}
      <div className="space-y-3">
        <p className={sectionTitle}>Évolution des parrains</p>
        {data.partners.length === 0 && <p className="text-sm text-muted-foreground">Aucun parrain pour le moment.</p>}
        {data.partners.map((p) => (
          <div key={p.userId} className="grid grid-cols-2 gap-2 rounded-2xl border border-border p-4 text-xs tabular-nums sm:grid-cols-5">
            <span className="font-mono font-semibold">{p.code}</span>
            <span>{p.signups} inscrits</span>
            <span>{p.conversions} achats</span>
            <span>{p.available.toFixed(2)} € dispo</span>
            <span>{p.paid.toFixed(2)} € versé</span>
          </div>
        ))}
      </div>
    </section>
  );
}
