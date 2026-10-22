import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getPartnerDashboard,
  setPartnerCountry,
  requestPartnerWithdrawal,
  type PartnerDashboard as Dashboard,
} from "@/lib/partner.functions";
import { SUPPORTED_COUNTRIES, formatLocalAmount, getFlagEmoji } from "@/lib/payments/countries";
import { PARTNER_COMMISSION_PERCENT, PARTNER_INSPIRATIONS } from "@/lib/partner-config";

const glass = "rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-2xl transition-all duration-500 ease-out";
const field = "w-full rounded-2xl border border-white/10 bg-background/60 px-4 py-3 text-sm outline-none transition-all duration-300 focus:border-primary/60";
const pill = "inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[0_10px_40px_-12px] shadow-primary/60 transition-all duration-500 ease-out hover:-translate-y-0.5 active:scale-[0.98] disabled:translate-y-0 disabled:opacity-40";
const soft = "inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-medium transition-all duration-300 hover:bg-white/10 active:scale-[0.98]";

const fmtEur = (n: number) => `${n.toFixed(2)} €`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

/** Espace partenaire : lien affilié, évolution, solde, retraits et idées d'inspiration. */
export function PartnerDashboard() {
  const fetchDash = useServerFn(getPartnerDashboard);
  const saveCountry = useServerFn(setPartnerCountry);
  const withdraw = useServerFn(requestPartnerWithdrawal);

  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "idea" | null>(null);
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

  const flash = (what: "link" | "idea") => {
    setCopied(what);
    setTimeout(() => setCopied(null), 1600);
  };

  const copyLink = async (link: string) => {
    await navigator.clipboard.writeText(link).catch(() => undefined);
    flash("link");
  };

  const shareLink = async (link: string) => {
    const text = `Découvrez Sam Flash : des images et vidéos créées par IA. ${link}`;
    if (navigator.share) await navigator.share({ text, url: link }).catch(() => undefined);
    else await copyLink(link);
  };

  const copyIdea = async (prompt: string) => {
    await navigator.clipboard.writeText(prompt).catch(() => undefined);
    flash("idea");
  };

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
  if (!data) return <p className="text-sm text-muted-foreground">Chargement de votre espace…</p>;

  const canWithdraw = data.balance.available >= data.minimumEur && !!data.country;

  return (
    <section className="space-y-5">
      {/* Lien affilié */}
      <div className={`${glass} relative overflow-hidden`}>
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/25 blur-[70px]" />
        <p className="relative text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Votre lien affilié</p>
        <p className="relative mt-2 text-sm text-muted-foreground">
          Partagez-le. Chaque personne qui s'inscrit avec et achète un abonnement vous rapporte {PARTNER_COMMISSION_PERCENT} %.
        </p>
        <a
          href={data.link}
          target="_blank"
          rel="noopener noreferrer"
          className="relative mt-4 block break-all rounded-2xl border border-white/10 bg-background/60 px-4 py-3.5 font-mono text-sm text-sky-300 underline-offset-4 hover:underline"
        >
          {data.link}
        </a>
        <div className="relative mt-4 flex flex-wrap gap-3">
          <button type="button" className={pill} onClick={() => void copyLink(data.link)}>
            {copied === "link" ? "Lien copié ✓" : "Copier le lien"}
          </button>
          <button type="button" className={soft} onClick={() => void shareLink(data.link)}>Partager</button>
        </div>
      </div>

      {/* Évolution */}
      <div className="grid grid-cols-2 gap-3">
        <div className={glass}>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Inscriptions</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{data.signups}</p>
        </div>
        <div className={glass}>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Achats convertis</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{data.conversions}</p>
        </div>
      </div>

      {/* Solde */}
      <div className={glass}>
        <p className="text-sm font-semibold">Votre solde</p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl bg-white/[0.03] py-3">
            <p className="text-base font-semibold tabular-nums">{fmtEur(data.balance.available)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Disponible</p>
          </div>
          <div className="rounded-2xl bg-white/[0.03] py-3">
            <p className="text-base font-semibold tabular-nums">{fmtEur(data.balance.reserved)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">En retrait</p>
          </div>
          <div className="rounded-2xl bg-white/[0.03] py-3">
            <p className="text-base font-semibold tabular-nums">{fmtEur(data.balance.paid)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Versé</p>
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
              <option key={c.code} value={c.code}>{getFlagEmoji(c.code)} {c.name} ({c.currency})</option>
            ))}
          </select>
          {data.minimumLocal ? (
            <p className="text-xs text-muted-foreground">
              Retrait possible dès {data.minimumUsd} $, soit{" "}
              <span className="font-medium text-foreground">{formatLocalAmount(data.minimumLocal.amount, data.minimumLocal.currency)}</span>.
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
            <input className={field} placeholder="Numéro de réception" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            <button className={pill} disabled={busy || mobile.trim().length < 6} onClick={() => void onWithdraw()}>
              Demander le retrait
            </button>
          </div>
        ) : (
          <p className="mt-5 text-xs text-muted-foreground">
            {data.country
              ? "Le retrait apparaît dès que votre solde disponible atteint le minimum."
              : "Choisissez votre pays pour activer les retraits."}
          </p>
        )}
        {notice && <p className="mt-3 rounded-2xl bg-primary/10 px-4 py-3 text-sm">{notice}</p>}
      </div>

      {/* Inspiration */}
      <div className={glass}>
        <p className="text-sm font-semibold">Idées pour inspirer vos publications</p>
        <p className="mt-1 text-xs text-muted-foreground">Copiez une idée, collez-la dans Sam Flash, puis adaptez-la à votre produit.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PARTNER_INSPIRATIONS.map((idea) => (
            <button
              key={idea.title}
              type="button"
              onClick={() => void copyIdea(idea.prompt)}
              className="group rounded-2xl border border-white/10 bg-background/40 p-4 text-left transition-all duration-500 ease-out hover:-translate-y-0.5 hover:border-primary/40 active:scale-[0.98]"
            >
              <p className="text-[11px] text-sky-300">{idea.format}</p>
              <p className="mt-1 text-sm font-semibold">{idea.title}</p>
              <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{idea.prompt}</p>
              <p className="mt-3 text-[11px] text-muted-foreground transition-colors group-hover:text-foreground">
                {copied === "idea" ? "Idée copiée ✓" : "Copier l'idée"}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Historique */}
      <div className={glass}>
        <p className="text-sm font-semibold">Derniers achats de vos filleuls</p>
        {data.sales.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Aucun achat pour le moment.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/10">
            {data.sales.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3 text-sm">
                <span className="text-muted-foreground">{fmtDate(s.date)}</span>
                <span className="tabular-nums">achat {fmtEur(s.orderAmount)}</span>
                <span className="font-medium tabular-nums">+{fmtEur(s.commission)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {data.withdrawals.length > 0 && (
        <div className={glass}>
          <p className="text-sm font-semibold">Vos demandes de retrait</p>
          <ul className="mt-3 divide-y divide-white/10">
            {data.withdrawals.map((w) => (
              <li key={w.id} className="flex items-center justify-between py-3 text-sm">
                <span className="text-muted-foreground">{fmtDate(w.date)}</span>
                <span className="tabular-nums">{formatLocalAmount(w.amountLocal, w.currency)}</span>
                <span className="text-xs">{w.status === "en_attente" ? "En attente" : w.status === "verse" ? "Versé" : "Refusé"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
