import { useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getMyPartnerApplication,
  submitPartnerApplication,
  type PartnerApplication,
} from "@/lib/partner.functions";
import { SUPPORTED_COUNTRIES, getFlagEmoji } from "@/lib/payments/countries";
import { PARTNER_COMMISSION_PERCENT } from "@/lib/partner-config";

const card = "rounded-3xl border border-white/10 bg-card/60 p-5 backdrop-blur-xl transition-all duration-500 ease-out";
const field = "w-full rounded-2xl border border-white/10 bg-background/60 px-4 py-3 text-sm outline-none transition-colors duration-300 focus:border-primary/60";
const pill = "rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-all duration-500 ease-out hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] disabled:opacity-40 disabled:hover:translate-y-0";

/**
 * Porte d'accès au tableau de bord partenaire : formulaire si pas de demande,
 * message d'attente ou de refus, et contenu seulement une fois approuvé.
 */
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
      <div className={card}>
        <p className="text-sm font-semibold">Demande en cours d'examen</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Nous avons bien reçu votre demande. Vous aurez accès à votre espace partenaire dès qu'elle sera approuvée.
        </p>
      </div>
    );
  }
  if (app.status === "refuse") {
    return (
      <div className={card}>
        <p className="text-sm font-semibold">Demande non retenue</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {app.adminNote ?? "Votre demande n'a pas été retenue pour le moment."}
        </p>
      </div>
    );
  }
  return <ApplicationForm onSent={reload} />;
}

function ApplicationForm({ onSent }: { onSent: () => void }) {
  const submit = useServerFn(submitPartnerApplication);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    countryCode: "",
    channels: "",
    audience: "",
    acceptTerms: false,
  });
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const valid =
    form.fullName.trim().length >= 3 &&
    form.email.includes("@") &&
    form.phone.trim().length >= 6 &&
    form.countryCode !== "" &&
    form.channels.trim().length >= 5 &&
    form.acceptTerms;

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

  return (
    <section className={card}>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Devenir partenaire</p>
      <h2 className="mt-1 text-xl font-semibold">Rejoignez le programme</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Remplissez ce formulaire. Une fois approuvé, vous touchez {PARTNER_COMMISSION_PERCENT} % du premier paiement de chaque
        personne qui s'inscrit avec votre code.
      </p>

      <div className="mt-5 space-y-3">
        <input className={field} placeholder="Nom et prénom" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
        <input className={field} type="email" placeholder="Adresse e-mail" value={form.email} onChange={(e) => set("email", e.target.value)} />
        <input className={field} placeholder="Numéro de téléphone (avec indicatif)" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        <select className={field} value={form.countryCode} onChange={(e) => set("countryCode", e.target.value)}>
          <option value="">Votre pays</option>
          {SUPPORTED_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {getFlagEmoji(c.code)} {c.name}
            </option>
          ))}
        </select>
        <textarea
          className={`${field} min-h-[90px]`}
          placeholder="Où publiez-vous du contenu ? (liens TikTok, Instagram, YouTube, chaîne…)"
          value={form.channels}
          onChange={(e) => set("channels", e.target.value)}
        />
        <textarea
          className={`${field} min-h-[70px]`}
          placeholder="Votre audience approximative (facultatif)"
          value={form.audience}
          onChange={(e) => set("audience", e.target.value)}
        />

        <label className="flex items-start gap-3 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={form.acceptTerms}
            onChange={(e) => set("acceptTerms", e.target.checked)}
          />
          <span>
            J'ai lu et j'accepte les{" "}
            <a href="/conditions-partenaires" className="underline text-foreground">conditions du programme partenaires</a>.
          </span>
        </label>

        <button className={pill} disabled={!valid || busy} onClick={() => void onSubmit()}>
          Envoyer ma demande
        </button>
        {notice && <p className="rounded-2xl bg-primary/10 px-4 py-3 text-sm">{notice}</p>}
      </div>
    </section>
  );
}
