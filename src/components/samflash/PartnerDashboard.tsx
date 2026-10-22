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

const glass = "rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-2xl";
const field = "w-full rounded-2xl border border-white/10 bg-background/60 px-4 py-3.5 text-sm outline-none transition-all duration-300 focus:border-primary/60";
const pill = "inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_10px_40px_-12px] shadow-primary/60 transition-all duration-500 ease-out hover:-translate-y-0.5 active:scale-[0.98] disabled:translate-y-0 disabled:opacity-40";
const soft = "inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium transition-all duration-300 hover:bg-white/10 active:scale-[0.98]";

const STEPS = [
  { id: "link", label: "Mon lien" },
  { id: "results", label: "Résultats" },
  { id: "earnings", label: "Gains" },
  { id: "withdraw", label: "Retrait" },
  { id: "ideas", label: "Idées" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

const fmtEur = (n: number) => `${n.toFixed(2)} €`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

/** Espace partenaire, en étapes : une seule partie à la fois. */
export function PartnerDashboard() {
  const fetchDash = useServerFn(getPartnerDashboard);
  const saveCountry = useServerFn(setPartnerCountry);
  const withdraw = useServerFn(requestPartnerWithdrawal);

  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<StepId>("link");
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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

  const copyLink = async (link: string) => {
    await navigator.clipboard.writeText(link).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const shareLink = async (link: string) => {
    const text = `Découvrez Sam Flash : des images et vidéos créées par IA. ${link}`;
    if (navigator.share) await navigator.share({ text, url: link }).catch(() => undefined);
    else await copyLink(link);
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

  const index = STEPS.findIndex((s) => s.id === step);
  const goTo = (i: number) => setStep(STEPS[Math.max(0, Math.min(STEPS.length - 1, i))].id);
  const canWithdraw = data.balance.available >= data.minimumEur && !!data.country;

  return (
    <section className="space-y-6">
      {/* Barre d'étapes */}
      <nav className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="uppercase tracking-[0.2em]">Espace partenaire</span>
          <span className="tabular-nums">Étape {index + 1} sur {STEPS.length}</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-sky-300 transition-all duration-700 ease-out" style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} />
        </div>
        <div className="grid grid-cols-5 gap-1">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={`rounded-xl py-2 text-[11px] font-medium transition-all duration-500 ${
                i === index ? "bg-white/10 text-foreground" : i < index ? "text-foreground/70" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </nav>

      <div key={step} className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {step === "link" && (
          <div className={`${glass} relative overflow-hidden`}>
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/25 blur-[70px]" />
            <h2 className="relative text-xl font-semibold tracking-tight">Votre lien affilié</h2>
            <p className="relative mt-2 text-sm text-muted-foreground">
              Partagez ce lien. Chaque personne qui s'inscrit avec et achète un abonnement vous rapporte {PARTNER_COMMISSION_PERCENT} %.
            </p>
            <a href={data.link} target="_blank" rel="noopener noreferrer" className="relative mt-5 block break-all rounded-2xl border border-white/10 bg-background/60 px-4 py-4 font-mono text-sm text-sky-300 underline-offset-4 hover:underline">
              {data.link}
            </a>
            <div className="relative mt-5 flex flex-wrap gap-3">
              <button type="button" className={pill} onClick={() => void copyLink(data.link)}>{copied ? "Lien copié ✓" : "Copier le lien"}</button>
              <button type="button" className={soft} onClick={() => void shareLink(data.link)}>Partager</button>
            </div>
          </div>
        )}

        {step === "results" && (
          <div className="grid grid-cols-2 gap-3">
            <div className={glass}>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Inscriptions</p>
              <p className="mt-3 text-4xl font-semibold tabular-nums">{data.signups}</p>
              <p className="mt-2 text-xs text-muted-foreground">personnes inscrites avec votre lien</p>
            </div>
            <div className={glass}>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Achats</p>
              <p className="mt-3 text-4xl font-semibold tabular-nums">{data.conversions}</p>
              <p className="mt-2 text-xs text-muted-foreground">premiers abonnements</p>
            </div>
          </div>
        )}

        {step === "earnings" && (
          <div className={`${glass} space-y-5`}>
            <h2 className="text-xl font-semibold tracking-tight">Vos gains</h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-white/[0.03] py-4">
                <p className="text-base font-semibold tabular-nums">{fmtEur(data.balance.available)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Disponible</p>
              </div>
              <div className="rounded-2xl bg-white/[0.03] py-4">
                <p className="text-base font-semibold tabular-nums">{fmtEur(data.balance.reserved)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">En retrait</p>
              </div>
              <div className="rounded-2xl bg-white/[0.03] py-4">
                <p className="text-base font-semibold tabular-nums">{fmtEur(data.balance.paid)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Versé</p>
              </div>
            </div>
            {data.sales.length === 0 ? (
              <p className="text-sm text-muted-foreground">Vos commissions apparaîtront ici dès le premier achat de vos filleuls.</p>
            ) : (
              <ul className="divide-y divide-white/10">
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
        )}

        {step === "withdraw" && (
          <div className={`${glass} space-y-5`}>
            <h2 className="text-xl font-semibold tracking-tight">Retrait</h2>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground" htmlFor="partner-country">Pays de versement</label>
              <select id="partner-country" className={field} value={data.country?.code ?? ""} disabled={busy} onChange={(e) => e.target.value && void onCountry(e.target.value)}>
                <option value="" disabled>Choisir un pays</option>
                {SUPPORTED_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{getFlagEmoji(c.code)} {c.name} ({c.currency})</option>
                ))}
              </select>
              {data.minimumLocal ? (
                <p className="text-xs text-muted-foreground">
                  Minimum : {data.minimumUsd} $, soit <span className="font-medium text-foreground">{formatLocalAmount(data.minimumLocal.amount, data.minimumLocal.currency)}</span>.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Choisissez votre pays pour voir le minimum.</p>
              )}
            </div>
            {canWithdraw ? (
              <div className="space-y-3">
                <select className={field} value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option>Mobile Money</option>
                  <option>Virement bancaire</option>
                </select>
                <input className={field} placeholder="Numéro de réception" value={mobile} onChange={(e) => setMobile(e.target.value)} />
                <button className={pill} disabled={busy || mobile.trim().length < 6} onClick={() => void onWithdraw()}>Demander le retrait</button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Le retrait s'ouvre dès que votre solde disponible atteint le minimum.</p>
            )}
            {notice && <p className="rounded-2xl bg-primary/10 px-4 py-3 text-sm">{notice}</p>}
          </div>
        )}

        {step === "ideas" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Idées de contenu</h2>
              <p className="mt-1 text-sm text-muted-foreground">Des pistes pour présenter Sam Flash à votre audience, sans avoir à créer de vidéo.</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {PARTNER_INSPIRATIONS.map((idea) => (
                <article key={idea.title} className={`${glass} !p-5`}>
                  <p className="text-[11px] text-sky-300">{idea.format}</p>
                  <h3 className="mt-1 text-base font-semibold">{idea.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{idea.idea}</p>
                  <p className="mt-4 rounded-2xl bg-white/[0.04] px-4 py-3 text-sm italic">« {idea.hook} »</p>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation entre étapes */}
      <div className="flex items-center justify-between">
        <button type="button" className={soft} disabled={index === 0} onClick={() => goTo(index - 1)}>Précédent</button>
        <button type="button" className={pill} disabled={index === STEPS.length - 1} onClick={() => goTo(index + 1)}>Suivant</button>
      </div>
    </section>
  );
}
