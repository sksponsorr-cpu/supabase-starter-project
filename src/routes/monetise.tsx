import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Coins, CheckCircle2, Clock, XCircle } from "lucide-react";
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

const TIER_LABEL = { essai: "Essai", light: "Sam Flash Light", pro: "Sam Flash Pro" } as const;
const eur = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;

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
    const flag = new URLSearchParams(window.location.search).get("tiktok");
    const msg: Record<string, string> = {
      connected: "Compte TikTok connecté !",
      refused: "Connexion TikTok annulée.",
      expired: "La demande a expiré, recommencez.",
      used: "Ce compte TikTok est déjà lié à un autre compte Sam Flash.",
      error: "Connexion TikTok impossible, réessayez.",
    };
    if (flag && msg[flag]) (flag === "connected" ? toast.success : toast.error)(msg[flag]);
    refresh();
  }, [session, refresh]);

  // Synchronisation automatique des vues TikTok à l'ouverture de la page.
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
  const input = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm";
  const btn = "w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50";

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} onOpenPlans={() => setPlansOpen(true)} />
      <div className={`flex-1 transition-all flex flex-col overflow-x-hidden ${isCollapsed ? "md:pl-16" : "md:pl-60"}`}>
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/40 px-4 py-3 md:px-6 md:py-4 pl-16 md:pl-6">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
            <h1 className="text-base sm:text-lg md:text-xl font-semibold">Monétise</h1>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-2xl w-full mx-auto space-y-4">
          {error && <p className="text-sm text-destructive">Impossible de charger la page.</p>}
          {!data && !error && <p className="text-sm text-muted-foreground animate-pulse">Chargement...</p>}

          {data && s && (
            <>
              <section className="rounded-2xl border border-border bg-card/40 p-4 space-y-2">
                <h2 className="font-semibold">Gagnez de l'argent en parlant de Sam Flash</h2>
                <p className="text-sm text-muted-foreground">
                  Publiez une vidéo sur notre outil, atteignez {s.min_views.toLocaleString("fr-FR")} vues, et soyez payé pour chaque tranche de 1 000 vues, comme sur les programmes de monétisation des réseaux.
                </p>
                {!s.enabled && <p className="rounded-xl bg-secondary/60 px-3 py-2 text-sm">Le programme est momentanément fermé.</p>}
              </section>

              <section className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
                <h2 className="font-semibold">Combien vous gagnez (RPM)</h2>
                <p className="text-xs text-muted-foreground">Gain pour 1 000 vues éligibles. Plus votre abonnement est élevé, plus le RPM est élevé.</p>
                <div className="divide-y divide-border/60 rounded-xl border border-border">
                  {(["essai", "light", "pro"] as const).map((t) => (
                    <div key={t} className={`flex items-center justify-between px-3 py-2.5 text-sm ${data.tier === t ? "bg-primary/10" : ""}`}>
                      <span>
                        {TIER_LABEL[t]}
                        {data.tier === t && <span className="ml-2 text-xs text-primary">votre offre</span>}
                      </span>
                      <span className="font-semibold">{eur(s[`rpm_${t}` as const])} / 1 000 vues</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
                <h2 className="font-semibold">Conditions</h2>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {s.rules.split("\n").filter((l) => l.trim()).map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                  <li>Retrait minimum : {eur(s.min_withdrawal_eur)}, versé dans votre monnaie locale.</li>
                  <li>Les gains sont disponibles {s.hold_days} jours après validation de la vidéo.</li>
                  <li>Moyens de retrait : {s.withdrawal_methods}.</li>
                </ul>
                <div>
                  <p className="mb-1.5 text-sm font-medium">Pays éligibles</p>
                  <div className="flex flex-wrap gap-1.5">
                    {s.eligible_countries.length === 0 && <span className="text-sm text-muted-foreground">Bientôt disponible.</span>}
                    {s.eligible_countries.map((c) => (
                      <span key={c} className="rounded-full bg-secondary/60 px-2.5 py-1 text-xs">
                        {countryName(c)}
                      </span>
                    ))}
                  </div>
                </div>
              </section>

              {!data.tier ? (
                <section className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
                  <h2 className="font-semibold">Un abonnement est nécessaire</h2>
                  <p className="text-sm text-muted-foreground">Prenez un abonnement (Essai, Light ou Pro) pour participer.</p>
                  <button className={btn} onClick={() => setPlansOpen(true)}>Voir les abonnements</button>
                </section>
              ) : (
                <>
                  <section className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
                    <h2 className="font-semibold">Mon profil créateur</h2>
                    <select value={country} onChange={(e) => setCountry(e.target.value)} className={input}>
                      <option value="">Choisir mon pays</option>
                      {s.eligible_countries.map((c) => (
                        <option key={c} value={c}>{countryName(c)}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
                      J'ai 18 ans ou plus
                    </label>
                    <button
                      className={btn}
                      disabled={busy || !country}
                      onClick={() => void run(() => saveProfile({ data: { country, adult } }))}
                    >
                      Enregistrer
                    </button>
                  </section>

                  {ready && (
                    <section className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
                      <h2 className="font-semibold">Connecter TikTok (automatique)</h2>
                      {data.tiktok.connected ? (
                        <>
                          <p className="text-sm text-muted-foreground">
                            Compte connecté : <span className="font-medium text-foreground">{data.tiktok.displayName ?? "TikTok"}</span>. Vos nouvelles vidéos qui parlent de Sam Flash sont détectées toutes seules, et vos gains suivent vos vues.
                          </p>
                          <div className="flex gap-2">
                            <button className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium disabled:opacity-50" disabled={busy}
                              onClick={() => void run(() => syncTiktok())}>Actualiser mes vues</button>
                            <button className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium disabled:opacity-50" disabled={busy}
                              onClick={() => void run(() => unlinkTiktok())}>Déconnecter</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-muted-foreground">
                            Connectez votre compte TikTok : nous détectons les vidéos que vous publiez après la connexion et qui mentionnent Sam Flash, puis nous comptons les vues automatiquement. Aucune capture à envoyer.
                          </p>
                          <button className={btn} disabled={busy || !data.tiktok.configured}
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
                            }}>
                            {data.tiktok.configured ? "Connecter mon compte TikTok" : "Bientôt disponible"}
                          </button>
                        </>
                      )}
                    </section>
                  )}

                  {ready && (
                    <section className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
                      <h2 className="font-semibold">Soumettre une vidéo à la main</h2>
                      <input className={input} placeholder="Lien de la vidéo (TikTok, YouTube, Instagram, Facebook)" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
                      <input className={input} type="date" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} />
                      <input className={input} inputMode="numeric" placeholder="Nombre de vues actuel" value={views} onChange={(e) => setViews(e.target.value.replace(/\D/g, ""))} />
                      <input className={input} placeholder="Lien de votre vidéo d'écran des statistiques (optionnel)" value={record} onChange={(e) => setRecord(e.target.value)} />
                      <button
                        className={btn}
                        disabled={busy || !videoUrl || !publishedAt || !views}
                        onClick={() =>
                          void run(
                            () => submit({ data: { videoUrl, publishedAt, claimedViews: Number(views), screenRecordUrl: record } }),
                            () => { setVideoUrl(""); setPublishedAt(""); setViews(""); setRecord(""); },
                          )
                        }
                      >
                        Envoyer pour vérification
                      </button>
                    </section>
                  )}

                  <section className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
                    <h2 className="font-semibold">Mes gains</h2>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-secondary/50 p-3"><p className="text-lg font-semibold">{eur(data.balance.available)}</p><p className="text-xs text-muted-foreground">Disponible</p></div>
                      <div className="rounded-xl bg-secondary/50 p-3"><p className="text-lg font-semibold">{eur(data.balance.pendingHold)}</p><p className="text-xs text-muted-foreground">En attente</p></div>
                      <div className="rounded-xl bg-secondary/50 p-3"><p className="text-lg font-semibold">{eur(data.balance.withdrawn)}</p><p className="text-xs text-muted-foreground">Retiré</p></div>
                    </div>
                    {data.balance.available >= s.min_withdrawal_eur ? (
                      <>
                        <input className={input} placeholder="Moyen de retrait (ex. Mobile Money)" value={method} onChange={(e) => setMethod(e.target.value)} />
                        <input className={input} placeholder="Numéro ou coordonnées du compte" value={details} onChange={(e) => setDetails(e.target.value)} />
                        <button className={btn} disabled={busy || !method || !details} onClick={() => void run(() => withdraw({ data: { method, details } }), () => setDetails(""))}>
                          Retirer {eur(data.balance.available)}
                        </button>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Retrait possible à partir de {eur(s.min_withdrawal_eur)} disponibles.</p>
                    )}
                    {data.withdrawals.map((w) => (
                      <p key={w.id} className="text-sm">
                        {eur(w.amount_eur)} · {w.method} ·{" "}
                        {w.status === "paid" ? "payé" : w.status === "pending" ? "en cours" : `refusé${w.admin_note ? ` (${w.admin_note})` : ""}`}
                      </p>
                    ))}
                  </section>

                  {data.videos.length > 0 && (
                    <section className="rounded-2xl border border-border bg-card/40 p-4 space-y-2">
                      <h2 className="font-semibold">Mes vidéos</h2>
                      {data.videos.map((v) => (
                        <div key={v.id} className="flex items-start gap-2 rounded-xl border border-border p-3 text-sm">
                          {v.status === "approved" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : v.status === "pending" ? <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                          <div className="min-w-0 flex-1">
                            <p className="truncate">{v.platform} · {v.claimed_views.toLocaleString("fr-FR")} vues{v.source === "manual" ? " annoncées" : ""}</p>
                            <p className="text-xs text-muted-foreground">
                              {v.status === "approved" ? `Validée : ${(v.eligible_views ?? 0).toLocaleString("fr-FR")} vues éligibles, ${eur(v.earned_eur)}` : v.status === "pending" ? (v.source === "tiktok" ? `Suivi automatique : ${data.settings.min_views.toLocaleString("fr-FR")} vues nécessaires` : "En cours de vérification") : `Refusée : ${v.reject_reason ?? ""}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </section>
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
