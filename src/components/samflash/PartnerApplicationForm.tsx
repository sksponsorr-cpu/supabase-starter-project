import { useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getMyPartnerApplication,
  submitPartnerApplication,
  type PartnerApplication,
} from "@/lib/partner.functions";
import { SUPPORTED_COUNTRIES, getFlagEmoji, findCountry } from "@/lib/payments/countries";
import { PARTNER_COMMISSION_PERCENT } from "@/lib/partner-config";

const glass = "rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-2xl";
const field = "w-full rounded-2xl border border-white/10 bg-background/60 px-4 py-3.5 text-sm outline-none transition-all duration-300 placeholder:text-muted-foreground/60 focus:border-primary/60 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.15)]";
const pill = "inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_10px_40px_-12px] shadow-primary/60 transition-all duration-500 ease-out hover:-translate-y-0.5 active:scale-[0.98] disabled:translate-y-0 disabled:opacity-40";
const ghost = "rounded-full px-5 py-3 text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground";

/** Porte d'accès au tableau de bord partenaire : formulaire, attente, refus, ou contenu approuvé. */
export function PartnerGate({ children }: { children: ReactNode }) {
  const fetchApp = useServerFn(getMyPartnerApplication);
  const [app, setApp] = useState<PartnerApplication | null>(null);

  const reload = () =>
    fetchApp()
      .then((a) => setApp(a))
      .catch(() => setApp({ id: "", status: null, createdAt: null, adminNote: null }));

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!app) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (app.status === "approuve") return <>{children}</>;

  if (app.status === "en_attente") {
    return (
      <div className={`${glass} text-center`}>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/15 text-2xl">⏳</div>
        <p className="text-base font-semibold">Votre demande est en cours d'examen</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Nous revenons vers vous par e-mail dès qu'elle est approuvée. Votre lien affilié vous sera envoyé à ce moment-là.
        </p>
      </div>
    );
  }
  if (app.status === "refuse") {
    return (
      <div className={`${glass} text-center`}>
        <p className="text-base font-semibold">Demande non retenue</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          {app.adminNote ?? "Votre demande n'a pas été retenue pour le moment."}
        </p>
      </div>
    );
  }
  return <ApplicationWizard onSent={reload} />;
}

const STEPS = ["Vous", "Vos réseaux", "Confirmation"] as const;

type Form = {
  fullName: string;
  email: string;
  phone: string;
  countryCode: string;
  channels: string;
  audience: string;
  acceptTerms: boolean;
};

/** Formulaire en trois étapes, avec barre de progression et récapitulatif. */
function ApplicationWizard({ onSent }: { onSent: () => void }) {
  const submit = useServerFn(submitPartnerApplication);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({
    fullName: "",
    email: "",
    phone: "",
    countryCode: "",
    channels: "",
    audience: "",
    acceptTerms: false,
  });
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const stepValid = [
    form.fullName.trim().length >= 3 && form.email.includes("@") && form.phone.trim().length >= 6 && form.countryCode !== "",
    form.channels.trim().length >= 5,
    form.acceptTerms,
  ];

  const onSubmit = async () => {
    setBusy(true);
    setNotice(null);
    const res = await submit({ data: { ...form, acceptTerms: true as const } }).catch(() => ({
      ok: false,
      message: "Erreur réseau.",
    }));
    setNotice(res.message);
    if (res.ok) onSent();
    setBusy(false);
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <section className={`${glass} space-y-6`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="uppercase tracking-[0.2em]">Devenir partenaire</span>
          <span className="tabular-nums">Étape {step + 1} sur {STEPS.length}</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-sky-300 transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex gap-2 text-[11px] text-muted-foreground">
          {STEPS.map((label, i) => (
            <span key={label} className={`flex-1 text-center transition-colors duration-500 ${i <= step ? "text-foreground" : ""}`}>
              {label}
            </span>
          ))}
        </div>
      </div>

      <div key={step} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {step === 0 && (
          <>
            <h2 className="text-xl font-semibold tracking-tight">Parlez-nous de vous</h2>
            <p className="text-sm text-muted-foreground">Ces informations servent à vous envoyer votre lien et vos paiements.</p>
            <input className={field} placeholder="Nom et prénom" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
            <input className={field} type="email" placeholder="Adresse e-mail" value={form.email} onChange={(e) => set("email", e.target.value)} />
            <input className={field} placeholder="Téléphone avec indicatif" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            <select className={field} value={form.countryCode} onChange={(e) => set("countryCode", e.target.value)}>
              <option value="">Votre pays de versement</option>
              {SUPPORTED_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{getFlagEmoji(c.code)} {c.name}</option>
              ))}
            </select>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="text-xl font-semibold tracking-tight">Où vous publiez</h2>
            <p className="text-sm text-muted-foreground">Un lien par ligne : TikTok, Instagram, YouTube, WhatsApp…</p>
            <textarea className={`${field} min-h-[120px]`} placeholder={"https://tiktok.com/@votrecompte\nhttps://instagram.com/votrecompte"} value={form.channels} onChange={(e) => set("channels", e.target.value)} />
            <textarea className={`${field} min-h-[90px]`} placeholder="Votre audience approximative (facultatif)" value={form.audience} onChange={(e) => set("audience", e.target.value)} />
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-xl font-semibold tracking-tight">Vérifiez et envoyez</h2>
            <dl className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-background/40 text-sm">
              <div className="flex justify-between gap-4 p-4"><dt className="text-muted-foreground">Nom</dt><dd className="text-right">{form.fullName}</dd></div>
              <div className="flex justify-between gap-4 p-4"><dt className="text-muted-foreground">E-mail</dt><dd className="text-right break-all">{form.email}</dd></div>
              <div className="flex justify-between gap-4 p-4"><dt className="text-muted-foreground">Pays</dt><dd className="text-right">{findCountry(form.countryCode)?.name ?? "—"}</dd></div>
              <div className="flex justify-between gap-4 p-4"><dt className="text-muted-foreground">Réseaux</dt><dd className="max-w-[60%] whitespace-pre-line break-all text-right">{form.channels}</dd></div>
            </dl>
            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-background/40 p-4 text-xs text-muted-foreground">
              <input type="checkbox" className="mt-0.5 accent-primary" checked={form.acceptTerms} onChange={(e) => set("acceptTerms", e.target.checked)} />
              <span>
                J'ai lu et j'accepte les{" "}
                <a href="/conditions-partenaires" className="text-foreground underline underline-offset-4">conditions du programme</a>.
                Je comprends que la commission est de {PARTNER_COMMISSION_PERCENT} % sur le premier paiement de chaque filleul.
              </span>
            </label>
          </>
        )}
      </div>

      {notice && <p className="rounded-2xl bg-primary/10 px-4 py-3 text-sm">{notice}</p>}

      <div className="flex items-center justify-between gap-3">
        {step > 0 ? (
          <button type="button" className={ghost} onClick={() => setStep(step - 1)}>Retour</button>
        ) : <span />}
        {step < STEPS.length - 1 ? (
          <button type="button" className={pill} disabled={!stepValid[step]} onClick={() => setStep(step + 1)}>Continuer</button>
        ) : (
          <button type="button" className={pill} disabled={!stepValid[2] || busy} onClick={() => void onSubmit()}>
            {busy ? "Envoi…" : "Envoyer ma demande"}
          </button>
        )}
      </div>
    </section>
  );
}
