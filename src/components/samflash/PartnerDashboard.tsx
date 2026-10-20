import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getPartnerDashboard,
  setPartnerCountry,
  requestPartnerWithdrawal,
  type PartnerDashboard as Dashboard,
} from "@/lib/partner.functions";
import { SUPPORTED_COUNTRIES, formatLocalAmount, getFlagEmoji } from "@/lib/payments/countries";
import { PARTNER_COMMISSION_PERCENT } from "@/lib/partner-config";

const card = "rounded-3xl border border-white/10 bg-card/60 p-5 backdrop-blur-xl transition-all duration-500 ease-out";
const field = "w-full rounded-2xl border border-white/10 bg-background/60 px-4 py-3 text-sm outline-none transition-colors duration-300 focus:border-primary/60";
const pill = "rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-all duration-500 ease-out hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] disabled:opacity-40 disabled:hover:translate-y-0";

const fmtEur = (n: number) => `${n.toFixed(2)} €`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

/** Espace partenaire : évolution des filleuls, solde séparé, pays et demande de retrait. */
export function PartnerDashboard() {
  const fetchDash = useServerFn(getPartnerDashboard);
  const saveCountry = useServerFn(setPartnerCountry);
  const withdraw = useServerFn(requestPartnerWithdrawal);

  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState("Mobile Money");
  const [mobile, setMobile] = useState("");

  const reload = () =>
    fetchDash()
      .then((d) => setData(d))
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCountry = async (code: string) => {
    setBusy(true);
    setNotice(null);
    const res = await saveCountry({ data: { countryCode: code } }).catch(() => ({ ok: false, message: "Erreur réseau." }));
    if (!res.ok) setNotice(res.message ?? "Enregistrement impossible.");
    await reload();
    setBusy(false);
  };

  const onWithdraw = async () => {
    setBusy(true);
    setNotice(null);
    const res = await withdraw({ data: { method, mobile } }).catch(() => ({ ok: false, message: "Erreur réseau." }));
    setNotice(res.message);
    if (res.ok) setMobile("");
    await reload();
    setBusy(false);
  };

  if (error) return <p className="text-sm text-muted-foreground">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Chargement de votre espace partenaire…</p>;

  const canWithdraw = data.balance.available >= data.minimumEur && !!data.country;

  return (
    <section className="space-y-4">
      <div className={card}>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Programme partenaires</p>
        <h2 className="mt-1 text-xl font-semibold">{PARTNER_COMMISSION_PERCENT} % sur chaque premier achat</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Gagnez une commission sur les abonnements des personnes qui s'inscrivent avec votre code {data.code}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={card}>
          <p className="text-xs text-muted-foreground">Inscriptions</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{data.signups}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-muted-foreground">Achats convertis</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{data.conversions}</p>
        </div>
      </div>

      <div className={card}>
        <p className="text-sm font-semibold">Votre solde partenaire</p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg font-semibold tabular-nums">{fmtEur(data.balance.available)}</p>
            <p className="text-xs text-muted-foreground">Disponible</p>
          </div>
          <div>
            <p className="text-lg font-semibold tabular-nums">{fmtEur(data.balance.reserved)}</p>
            <p className="text-xs text-muted-foreground">En retrait</p>
          </div>
          <div>
            <p className="text-lg font-semibold tabular-nums">{fmtEur(data.balance.paid)}</p>
            <p className="text-xs text-muted-foreground">Versé</p>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <label className="text-xs text-muted-foreground" htmlFor="partner-country">Pays de versement</label>
          <select
            id="partner-country"
            className={field}
            value={data.country?.code ?? ""}
            disabled={busy}
            onChange={(e) => e.target.value && void onCountry(e.target.value)}
          >
            <option value="" disabled>Choisir un pays</option>
            {SUPPORTED_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {getFlagEmoji(c.code)} {c.name} ({c.currency})
              </option>
            ))}
          </select>
          {data.minimumLocal ? (
            <p className="text-xs text-muted-foreground">
              Retrait possible dès {data.minimumUsd} $, soit{" "}
              <span className="font-medium text-foreground">
                {formatLocalAmount(data.minimumLocal.amount, data.minimumLocal.currency)}
              </span>
              .
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Choisissez un pays pour voir le minimum de retrait.</p>
          )}
        </div>

        {canWithdraw ? (
          <div className="mt-5 space-y-3">
            <select className={field} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option>Mobile Money</option>
              <option>Virement bancaire</option>
            </select>
            <input
              className={field}
              placeholder="Numéro de réception"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
            <button className={pill} disabled={busy || mobile.trim().length < 6} onClick={() => void onWithdraw()}>
              Demander le retrait
            </button>
          </div>
        ) : (
          <p className="mt-5 text-xs text-muted-foreground">
            {data.country
              ? `Le bouton de retrait apparaît dès que votre solde disponible atteint le minimum.`
              : "Choisissez votre pays pour activer les retraits."}
          </p>
        )}

        {notice && <p className="mt-3 rounded-2xl bg-primary/10 px-4 py-3 text-sm">{notice}</p>}
      </div>

      <div className={card}>
        <p className="text-sm font-semibold">Derniers achats de vos filleuls</p>
        {data.sales.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Aucun achat pour le moment.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/10">
            {data.sales.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-muted-foreground">{fmtDate(s.date)}</span>
                <span className="tabular-nums">achat {fmtEur(s.orderAmount)}</span>
                <span className="font-medium tabular-nums">+{fmtEur(s.commission)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {data.withdrawals.length > 0 && (
        <div className={card}>
          <p className="text-sm font-semibold">Vos demandes de retrait</p>
          <ul className="mt-3 divide-y divide-white/10">
            {data.withdrawals.map((w) => (
              <li key={w.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-muted-foreground">{fmtDate(w.date)}</span>
                <span className="tabular-nums">{formatLocalAmount(w.amountLocal, w.currency)}</span>
                <span className="text-xs">
                  {w.status === "en_attente" ? "En attente" : w.status === "verse" ? "Versé" : "Refusé"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
