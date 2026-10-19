import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  Banknote,
  CheckCircle2,
  Clock,
  Coins,
  Globe,
  Link2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/samflash/Sidebar";
import { useSidebarStore } from "@/hooks/useSidebarStore";
import { SettingsSheet } from "@/components/samflash/SettingsSheet";
import { PlansSheet } from "@/components/samflash/PlansSheet";
import {
  getMonetizeOverview,
  saveCreatorProfile,
  submitMonetizeVideo,
  requestWithdrawal,
  startTiktokConnect,
  syncMyTiktok,
  disconnectTiktok,
  type MonetizeOverview,
} from "@/lib/monetize.functions";
import { countryName } from "@/lib/monetize-countries";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/monetise")({
  head: () => ({ meta: [{ title: "Monétise – Sam Flash 2.0" }] }),
  component: MonetisePage,
});

const TIERS = [
  { key: "essai", label: "Essai", hint: "Pour démarrer" },
  { key: "light", label: "Sam Flash Light", hint: "Créateur régulier" },
  { key: "pro", label: "Sam Flash Pro", hint: "Meilleur taux" },
] as const;

const eur = (n: number) =>
  `${n.toLocaleString("fr-FR", { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })} €`;

const flag = (code: string) =>
  /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0))) : "🌍";

/* ---------------------------- Petits composants ---------------------------- */

/** Apparition douce au défilement (désactivée si l'utilisateur limite les animations). */
function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`mz-reveal ${shown ? "mz-in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/** Nombre qui monte en douceur vers sa valeur. */
function AnimatedNumber({ value, format = eur }: { value: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 650);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(start + (value - start) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(Math.round(shown * 100) / 100)}</>;
}

const card = "rounded-3xl border border-border/60 bg-card/50 p-5 shadow-[0_8px_40px_-20px_rgba(0,0,0,.6)] backdrop-blur-xl sm:p-6";
const field = "w-full rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm outline-none transition focus:border-primary/60";
const btn = "w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[.98] disabled:opacity-50";
const btnGhost = "flex-1 rounded-full border border-border px-4 py-3 text-sm font-semibold transition active:scale-[.98] disabled:opacity-50";

const CSS = `
.mz-reveal{opacity:0;transform:translateY(26px);transition:opacity .8s cubic-bezier(.2,.7,.2,1),transform .8s cubic-bezier(.2,.7,.2,1)}
.mz-in{opacity:1;transform:none}
@keyframes mz-float{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(0,-24px,0) scale(1.06)}}
@keyframes mz-shine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
.mz-blob{position:absolute;border-radius:9999px;filter:blur(70px);opacity:.5;animation:mz-float 9s ease-in-out infinite;pointer-events:none}
.mz-grad{background:linear-gradient(95deg,#3de0ff,#2f8cff 35%,#8b5cf6 65%,#ff7a1a,#3de0ff);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:mz-shine 6s linear infinite}
.mz-tier{transition:transform .35s cubic-bezier(.2,.7,.2,1),box-shadow .35s}
.mz-tier:hover{transform:translateY(-4px)}
@media (prefers-reduced-motion:reduce){.mz-reveal{opacity:1;transform:none;transition:none}.mz-blob,.mz-grad{animation:none}}
`;

/* --------------------------------- Page ----------------------------------- */

function MonetisePage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const { isCollapsed } = useSidebarStore();
  const load = useServerFn(getMonetizeOverview);
  const saveProfile = useServerFn(saveCreatorProfile);
  const submit = useServerFn(submitMonetizeVideo);
  const withdraw = useServerFn(requestWithdrawal);
  const connectTiktok = useServerFn(startTiktokConnect);
  const syncTiktok = useServerFn(syncMyTiktok);
  const unlinkTiktok = useServerFn(disconnectTiktok);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [data, setData] = useState<MonetizeOverview | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const [country, setCountry] = useState("");
  const [adult, setAdult] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [views, setViews] = useState("");
  const [record, setRecord] = useState("");
  const [method, setMethod] = useState("");
  const [details, setDetails] = useState("");
  const [simViews, setSimViews] = useState(25000);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/" });
  }, [loading, session, navigate]);

  const refresh = useCallback(() => {
    load()
      .then((d) => {
        setData(d);
        if (d.country) setCountry(d.country);
        if (d.adultConfirmed) setAdult(true);
      })
      .catch(() => setError(true));
  }, [load]);

  useEffect(() => {
    if (!session) return;
    const flagParam = new URLSearchParams(window.location.search).get("tiktok");
    const msg: Record<string, string> = {
      connected: "Compte TikTok connecté !",
      refused: "Connexion TikTok annulée.",
      expired: "La demande a expiré, recommencez.",
      used: "Ce compte TikTok est déjà lié à un autre compte Sam Flash.",
      error: "Connexion TikTok impossible, réessayez.",
    };
    if (flagParam && msg[flagParam]) (flagParam === "connected" ? toast.success : toast.error)(msg[flagParam]);
    refresh();
  }, [session, refresh]);

  const tiktokConnected = data?.tiktok.connected ?? false;
  useEffect(() => {
    if (!tiktokConnected) return;
    syncTiktok()
      .then(() => refresh())
      .catch(() => undefined);
  }, [tiktokConnected, syncTiktok, refresh]);

  const run = async (fn: () => Promise<{ ok: boolean; message: string }>, after?: () => void) => {
    setBusy(true);
    try {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message);
        after?.();
        refresh();
      } else toast.error(r.message);
    } catch {
      toast.error("Une erreur est survenue, réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const s = data?.settings;
  const ready = !!data && !!data.tier && data.countryEligible && data.adultConfirmed;
  const rpmOf = (k: (typeof TIERS)[number]["key"]) => (s ? s[`rpm_${k}` as const] : 0);
  const gain = (k: (typeof TIERS)[number]["key"]) =>
    s && simViews >= s.min_views ? Math.floor((simViews / 1000) * rpmOf(k) * 100) / 100 : 0;
  const steps = [
    { icon: Wallet, title: "Abonnez-vous", text: "Un abonnement actif ouvre le programme." },
    { icon: Link2, title: "Connectez TikTok", text: "Vos vues sont comptées automatiquement." },
    { icon: Sparkles, title: "Publiez", text: "Une vidéo publique qui parle de Sam Flash." },
    { icon: Banknote, title: "Retirez", text: "Dans votre monnaie locale, dès le minimum atteint." },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <style>{CSS}</style>
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} onOpenPlans={() => setPlansOpen(true)} />
      <div className={`flex min-w-0 flex-1 flex-col overflow-x-hidden transition-all ${isCollapsed ? "md:pl-16" : "md:pl-60"}`}>
        <header className="sticky top-0 z-10 border-b border-border/40 bg-background/70 px-4 py-3 pl-16 backdrop-blur-xl md:px-6 md:pl-6">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-muted-foreground md:h-5 md:w-5" />
            <h1 className="text-base font-semibold sm:text-lg">Monétise</h1>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 pb-24 pt-6 sm:px-6">
          {error && <p className="text-sm text-destructive">Impossible de charger la page.</p>}
          {!data && !error && <p className="animate-pulse text-sm text-muted-foreground">Chargement...</p>}

          {data && s && (
            <>
              {/* Hero */}
              <section className="relative overflow-hidden rounded-[2rem] border border-border/50 px-6 py-12 text-center sm:py-16">
                <div className="mz-blob -left-10 -top-10 h-56 w-56 bg-[#2f8cff]" />
                <div className="mz-blob -bottom-16 right-0 h-64 w-64 bg-[#8b5cf6]" style={{ animationDelay: "-3s" }} />
                <div className="mz-blob left-1/2 top-1/3 h-40 w-40 bg-[#ff7a1a]" style={{ animationDelay: "-6s", opacity: 0.3 }} />
                <div className="relative">
                  <Reveal>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/50 px-3 py-1 text-xs font-medium backdrop-blur">
                      <Sparkles className="h-3.5 w-3.5" /> Programme créateurs
                    </span>
                  </Reveal>
                  <Reveal delay={80}>
                    <h2 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
                      Vos vidéos valent
                      <br />
                      <span className="mz-grad">de l'argent.</span>
                    </h2>
                  </Reveal>
                  <Reveal delay={160}>
                    <p className="mx-auto mt-5 max-w-md text-base text-muted-foreground sm:text-lg">
                      Parlez de Sam Flash sur TikTok. Dès {s.min_views.toLocaleString("fr-FR")} vues, chaque tranche de 1 000 vues vous est payée.
                    </p>
                  </Reveal>
                  <Reveal delay={240}>
                    <div className="mt-7 flex flex-wrap justify-center gap-2 text-xs">
                      {[
                        [Banknote, `Retrait dès ${eur(s.min_withdrawal_eur)}`],
                        [Globe, "Payé en monnaie locale"],
                        [ShieldCheck, "Vues vérifiées"],
                      ].map(([Icon, text], i) => {
                        const I = Icon as typeof Banknote;
                        return (
                          <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-secondary/60 px-3 py-1.5 font-medium">
                            <I className="h-3.5 w-3.5" /> {text as string}
                          </span>
                        );
                      })}
                    </div>
                  </Reveal>
                  {!s.enabled && <p className="mt-6 text-sm text-muted-foreground">Le programme est momentanément fermé.</p>}
                </div>
              </section>

              {/* Taux */}
              <section className="space-y-4">
                <Reveal>
                  <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">Combien vous gagnez</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Pour 1 000 vues éligibles. Plus votre abonnement est élevé, plus le taux monte.</p>
                </Reveal>
                <div className="grid gap-3 sm:grid-cols-3">
                  {TIERS.map((t, i) => {
                    const mine = data.tier === t.key;
                    const best = t.key === "pro";
                    return (
                      <Reveal key={t.key} delay={i * 90}>
                        <div
                          className={`mz-tier relative h-full rounded-3xl border p-5 ${
                            best ? "border-primary/60 bg-primary/10 shadow-[0_0_60px_-20px_hsl(var(--primary))]" : "border-border/60 bg-card/50"
                          }`}
                        >
                          {mine && (
                            <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                              <BadgeCheck className="h-3 w-3" /> Votre offre
                            </span>
                          )}
                          <p className="text-sm font-medium text-muted-foreground">{t.label}</p>
                          <p className="mt-3 text-4xl font-bold tracking-tight">{eur(rpmOf(t.key))}</p>
                          <p className="text-xs text-muted-foreground">pour 1 000 vues</p>
                          <p className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                            {best && <TrendingUp className="h-3.5 w-3.5" />} {t.hint}
                          </p>
                        </div>
                      </Reveal>
                    );
                  })}
                </div>
              </section>

              {/* Simulateur */}
              <Reveal>
                <section className={card}>
                  <h3 className="text-xl font-bold tracking-tight">Simulez vos gains</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Faites glisser pour voir ce que rapporte une vidéo.</p>
                  <p className="mt-5 text-center text-5xl font-bold tracking-tight">
                    <AnimatedNumber value={simViews} format={(n) => Math.round(n).toLocaleString("fr-FR")} />
                    <span className="ml-2 text-base font-medium text-muted-foreground">vues</span>
                  </p>
                  <input
                    type="range"
                    min={1000}
                    max={500000}
                    step={1000}
                    value={simViews}
                    onChange={(e) => setSimViews(Number(e.target.value))}
                    className="mt-4 w-full accent-[hsl(var(--primary))]"
                    aria-label="Nombre de vues"
                  />
                  <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                    {TIERS.map((t) => (
                      <div key={t.key} className="rounded-2xl bg-secondary/50 p-3">
                        <p className="text-lg font-bold sm:text-2xl">
                          <AnimatedNumber value={gain(t.key)} />
                        </p>
                        <p className="text-[11px] text-muted-foreground">{t.label}</p>
                      </div>
                    ))}
                  </div>
                  {simViews < s.min_views && (
                    <p className="mt-3 text-center text-xs text-muted-foreground">
                      Le programme démarre à {s.min_views.toLocaleString("fr-FR")} vues.
                    </p>
                  )}
                </section>
              </Reveal>

              {/* Étapes */}
              <section className="space-y-4">
                <Reveal>
                  <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">Comment ça marche</h3>
                </Reveal>
                <div className="grid gap-3 sm:grid-cols-2">
                  {steps.map((st, i) => (
                    <Reveal key={st.title} delay={i * 90}>
                      <div className={`${card} flex items-start gap-4`}>
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                          <st.icon className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="font-semibold">
                            <span className="mr-1.5 text-muted-foreground">{i + 1}.</span>
                            {st.title}
                          </p>
                          <p className="mt-0.5 text-sm text-muted-foreground">{st.text}</p>
                        </div>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </section>

              {/* Conditions */}
              <Reveal>
                <section className={`${card} space-y-5`}>
                  <h3 className="text-xl font-bold tracking-tight">Conditions</h3>
                  <ul className="space-y-2.5">
                    {[
                      ...s.rules.split("\n").filter((l) => l.trim()),
                      `Retrait minimum : ${eur(s.min_withdrawal_eur)}, versé dans votre monnaie locale.`,
                      `Gains disponibles ${s.hold_days} jours après validation.`,
                      `Moyens de retrait : ${s.withdrawal_methods}.`,
                    ].map((l, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{l}</span>
                      </li>
                    ))}
                  </ul>
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                      <Globe className="h-4 w-4" /> Pays éligibles ({s.eligible_countries.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {s.eligible_countries.length === 0 && (
                        <span className="text-sm text-muted-foreground">La liste des pays sera publiée très bientôt.</span>
                      )}
                      {s.eligible_countries.map((c) => (
                        <span key={c} className="inline-flex items-center gap-1.5 rounded-full bg-secondary/60 px-2.5 py-1 text-xs">
                          <span>{flag(c)}</span>
                          {countryName(c)}
                        </span>
                      ))}
                    </div>
                  </div>
                </section>
              </Reveal>

              {/* Espace créateur */}
              {!data.tier ? (
                <Reveal>
                  <section className={`${card} text-center`}>
                    <h3 className="text-xl font-bold tracking-tight">Un abonnement est nécessaire</h3>
                    <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                      Prenez un abonnement (Essai, Light, Pro, Start ou One) pour participer et commencer à gagner.
                    </p>
                    <button className={`${btn} mx-auto mt-5 max-w-xs`} onClick={() => setPlansOpen(true)}>
                      Voir les abonnements
                    </button>
                  </section>
                </Reveal>
              ) : (
                <>
                  <Reveal>
                    <section className={`${card} space-y-4`}>
                      <h3 className="text-xl font-bold tracking-tight">Mon profil créateur</h3>
                      <select value={country} onChange={(e) => setCountry(e.target.value)} className={field}>
                        <option value="">Choisir mon pays</option>
                        {s.eligible_countries.map((c) => (
                          <option key={c} value={c}>
                            {flag(c)} {countryName(c)}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-3 text-sm">
                        <input type="checkbox" className="h-5 w-5 rounded accent-[hsl(var(--primary))]" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
                        J'ai 18 ans ou plus
                      </label>
                      <button className={btn} disabled={busy || !country || !adult} onClick={() => void run(() => saveProfile({ data: { country, adult } }))}>
                        Enregistrer mon profil
                      </button>
                      {data.adultConfirmed && data.countryEligible && (
                        <p className="flex items-center justify-center gap-1.5 text-xs text-primary">
                          <BadgeCheck className="h-4 w-4" /> Profil validé
                        </p>
                      )}
                    </section>
                  </Reveal>

                  {ready && (
                    <>
                      <Reveal>
                        <section className={`${card} space-y-4`}>
                          <h3 className="text-xl font-bold tracking-tight">Connexion TikTok</h3>
                          {data.tiktok.connected ? (
                            <>
                              <p className="text-sm text-muted-foreground">
                                Compte connecté : <span className="font-semibold text-foreground">{data.tiktok.displayName ?? "TikTok"}</span>. Vos vidéos qui parlent de Sam Flash sont détectées
                                toutes seules et vos gains suivent vos vues.
                              </p>
                              <div className="flex gap-2">
                                <button className={btnGhost} disabled={busy} onClick={() => void run(() => syncTiktok())}>
                                  Actualiser mes vues
                                </button>
                                <button className={btnGhost} disabled={busy} onClick={() => void run(() => unlinkTiktok())}>
                                  Déconnecter
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="text-sm text-muted-foreground">
                                Connectez votre compte : nous détectons les vidéos publiées après la connexion qui mentionnent Sam Flash et comptons les vues pour vous. Aucune capture à envoyer.
                              </p>
                              <button
                                className={btn}
                                disabled={busy || !data.tiktok.configured}
                                onClick={async () => {
                                  setBusy(true);
                                  try {
                                    const r = await connectTiktok();
                                    if (r.ok && r.url) window.location.href = r.url;
                                    else toast.error(r.message);
                                  } catch {
                                    toast.error("Une erreur est survenue, réessayez.");
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                              >
                                {data.tiktok.configured ? "Connecter mon compte TikTok" : "Bientôt disponible"}
                              </button>
                            </>
                          )}
                        </section>
                      </Reveal>

                      <Reveal>
                        <section className={`${card} space-y-3`}>
                          <h3 className="text-xl font-bold tracking-tight">Soumettre une vidéo à la main</h3>
                          <input className={field} placeholder="Lien de la vidéo (TikTok, YouTube, Instagram, Facebook)" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
                          <input className={field} type="date" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} />
                          <input className={field} inputMode="numeric" placeholder="Nombre de vues actuel" value={views} onChange={(e) => setViews(e.target.value.replace(/\D/g, ""))} />
                          <input className={field} placeholder="Lien de votre vidéo d'écran des statistiques (optionnel)" value={record} onChange={(e) => setRecord(e.target.value)} />
                          <button
                            className={btn}
                            disabled={busy || !videoUrl || !publishedAt || !views}
                            onClick={() =>
                              void run(
                                () => submit({ data: { videoUrl, publishedAt, claimedViews: Number(views), screenRecordUrl: record } }),
                                () => {
                                  setVideoUrl("");
                                  setPublishedAt("");
                                  setViews("");
                                  setRecord("");
                                },
                              )
                            }
                          >
                            Envoyer pour vérification
                          </button>
                        </section>
                      </Reveal>
                    </>
                  )}

                  <Reveal>
                    <section className={`${card} space-y-5`}>
                      <h3 className="text-xl font-bold tracking-tight">Mes gains</h3>
                      <div>
                        <p className="text-5xl font-bold tracking-tight">
                          <AnimatedNumber value={data.balance.available} />
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">disponible au retrait</p>
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-700"
                            style={{ width: `${Math.min(100, (data.balance.available / Math.max(1, s.min_withdrawal_eur)) * 100)}%` }}
                          />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">Retrait possible dès {eur(s.min_withdrawal_eur)}.</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="rounded-2xl bg-secondary/50 p-3">
                          <p className="text-xl font-bold"><AnimatedNumber value={data.balance.pendingHold} /></p>
                          <p className="text-xs text-muted-foreground">En attente ({s.hold_days} jours)</p>
                        </div>
                        <div className="rounded-2xl bg-secondary/50 p-3">
                          <p className="text-xl font-bold"><AnimatedNumber value={data.balance.withdrawn} /></p>
                          <p className="text-xs text-muted-foreground">Déjà retiré</p>
                        </div>
                      </div>
                      {data.balance.available >= s.min_withdrawal_eur && (
                        <div className="space-y-3">
                          <input className={field} placeholder="Moyen de retrait (ex. Mobile Money)" value={method} onChange={(e) => setMethod(e.target.value)} />
                          <input className={field} placeholder="Numéro ou coordonnées du compte" value={details} onChange={(e) => setDetails(e.target.value)} />
                          <button className={btn} disabled={busy || !method || !details} onClick={() => void run(() => withdraw({ data: { method, details } }), () => setDetails(""))}>
                            Retirer {eur(data.balance.available)}
                          </button>
                        </div>
                      )}
                      {data.withdrawals.map((w) => (
                        <p key={w.id} className="text-sm text-muted-foreground">
                          {eur(w.amount_eur)} · {w.method} ·{" "}
                          {w.status === "paid" ? "payé" : w.status === "pending" ? "en cours" : `refusé${w.admin_note ? ` (${w.admin_note})` : ""}`}
                        </p>
                      ))}
                    </section>
                  </Reveal>

                  {data.videos.length > 0 && (
                    <Reveal>
                      <section className={`${card} space-y-2.5`}>
                        <h3 className="text-xl font-bold tracking-tight">Mes vidéos</h3>
                        {data.videos.map((v) => (
                          <div key={v.id} className="flex items-start gap-3 rounded-2xl border border-border/60 p-3.5 text-sm">
                            {v.status === "approved" ? (
                              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                            ) : v.status === "pending" ? (
                              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                            ) : (
                              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">
                                {v.platform} · {v.claimed_views.toLocaleString("fr-FR")} vues{v.source === "manual" ? " annoncées" : ""}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {v.status === "approved"
                                  ? `Validée : ${(v.eligible_views ?? 0).toLocaleString("fr-FR")} vues éligibles, ${eur(v.earned_eur)}`
                                  : v.status === "pending"
                                    ? v.source === "tiktok"
                                      ? `Suivi automatique : ${s.min_views.toLocaleString("fr-FR")} vues nécessaires`
                                      : "En cours de vérification"
                                    : `Refusée : ${v.reject_reason ?? ""}`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </section>
                    </Reveal>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
      {plansOpen && <PlansSheet onClose={() => setPlansOpen(false)} />}
    </div>
  );
}
