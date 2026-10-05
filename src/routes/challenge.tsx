import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clapperboard,
  Clock,
  Download,
  Gift,
  ImagePlus,
  Send,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/samflash/Sidebar";
import { useSidebarStore } from "@/hooks/useSidebarStore";
import { SettingsSheet } from "@/components/samflash/SettingsSheet";
import { PlansSheet } from "@/components/samflash/PlansSheet";
import { supabase } from "@/integrations/supabase/client";
import {
  listDemos,
  listMySubmissions,
  submitChallenge,
  CHALLENGE_MIN_VIEWS,
  CHALLENGE_WINDOW_DAYS,
  type PromoDemo,
  type MySubmission,
} from "@/lib/challenge.functions";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/challenge")({
  head: () => ({ meta: [{ title: "Challenge Promo – Sam Flash 2.0" }] }),
  component: ChallengePage,
});

const MAX_FILE = 5 * 1024 * 1024;
const STEPS = ["Démo", "Publication", "Preuve"] as const;

async function uploadProof(userId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("promo-proofs").upload(path, file, { contentType: file.type });
  if (error) throw new Error("Envoi de la capture impossible");
  return path;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-medium text-green-500">
        <CheckCircle2 className="h-3.5 w-3.5" /> Acceptée
      </span>
    );
  if (status === "rejected")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-medium text-destructive">
        <XCircle className="h-3.5 w-3.5" /> Refusée
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <Clock className="h-3.5 w-3.5" /> En vérification
    </span>
  );
}

function FileTile({
  title,
  hint,
  file,
  onPick,
}: {
  title: string;
  hint: string;
  file: File | null;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <label className="relative flex h-40 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border border-dashed border-border bg-secondary/30 px-3 text-center transition active:scale-[0.99]">
      {preview ? (
        <>
          <img src={preview} alt={title} className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-background/85 px-2.5 py-1 text-xs font-medium backdrop-blur">
            <Check className="h-3.5 w-3.5 text-green-500" /> Changer
          </span>
        </>
      ) : (
        <>
          <ImagePlus className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </>
      )}
      <input type="file" accept="image/*" onChange={onPick} className="sr-only" />
    </label>
  );
}

function ChallengePage() {
  const navigate = useNavigate();
  const { session, user, loading } = useAuth();
  const { isCollapsed } = useSidebarStore();
  const fetchDemos = useServerFn(listDemos);
  const fetchMine = useServerFn(listMySubmissions);
  const submit = useServerFn(submitChallenge);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [demos, setDemos] = useState<PromoDemo[]>([]);
  const [mine, setMine] = useState<MySubmission[]>([]);
  const [step, setStep] = useState(0);

  const [videoUrl, setVideoUrl] = useState("");
  const [demoId, setDemoId] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [views, setViews] = useState("");
  const [shot, setShot] = useState<File | null>(null);
  const [stats, setStats] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/" });
  }, [loading, session, navigate]);

  const refresh = useCallback(async () => {
    try {
      const [d, m] = await Promise.all([fetchDemos(), fetchMine()]);
      setDemos(d);
      setMine(m);
    } catch {
      /* ignoré */
    }
  }, [fetchDemos, fetchMine]);

  useEffect(() => {
    if (session) void refresh();
  }, [session, refresh]);

  const pick = (setter: (f: File | null) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && (!f.type.startsWith("image/") || f.size > MAX_FILE)) {
      toast.error("Image requise, 5 Mo maximum.");
      e.target.value = "";
      return;
    }
    setter(f);
  };

  const onSubmit = async () => {
    if (!user) return;
    const n = Number(views);
    if (!videoUrl || !publishedAt || !n || !shot || !stats) {
      toast.error("Remplissez tous les champs et ajoutez les 2 captures.");
      return;
    }
    if (!/^https:\/\/\S+\.\S+/.test(videoUrl.trim())) {
      toast.error("Collez le lien complet de votre vidéo (il doit commencer par https://).");
      return;
    }
    if (n < CHALLENGE_MIN_VIEWS) {
      toast.error(`Il faut au moins ${CHALLENGE_MIN_VIEWS.toLocaleString("fr-FR")} vues pour participer.`);
      return;
    }
    setSending(true);
    try {
      const [screenshotPath, statsPath] = await Promise.all([uploadProof(user.id, shot), uploadProof(user.id, stats)]);
      const res = await submit({
        data: {
          videoUrl: videoUrl.trim(),
          demoId: demoId || null,
          publishedAt,
          claimedViews: Math.floor(n),
          screenshotPath,
          statsPath,
        },
      });
      if (res.ok) {
        toast.success(res.message);
        setVideoUrl("");
        setDemoId("");
        setPublishedAt("");
        setViews("");
        setShot(null);
        setStats(null);
        setStep(0);
        void refresh();
      } else {
        toast.error(res.message);
      }
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      toast.error(
        msg && !msg.trim().startsWith("[") && !msg.includes("{")
          ? msg
          : "Envoi impossible, vérifiez les informations et réessayez.",
      );
    } finally {
      setSending(false);
    }
  };

  const field =
    "w-full rounded-2xl border border-border/60 bg-secondary/40 px-4 py-3 text-[15px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30";
  const card = "rounded-3xl border border-border/60 bg-card/50 p-5 backdrop-blur-xl";
  const primaryBtn =
    "flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-[15px] font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-60";
  const ghostBtn =
    "flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-secondary/40 px-4 py-3.5 text-[15px] font-medium transition active:scale-[0.98]";

  return (
    <div className="flex min-h-screen" style={{ background: "var(--gradient-hero)" }}>
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} onOpenPlans={() => setPlansOpen(true)} />

      <div className={`flex min-h-screen flex-1 flex-col overflow-x-hidden transition-all ${isCollapsed ? "md:pl-16" : "md:pl-60"}`}>
        <header className="sticky top-0 z-10 border-b border-border/40 bg-background/70 py-3 pl-16 pr-4 backdrop-blur-2xl md:px-6 md:py-4">
          <div className="flex items-center gap-2">
            <Clapperboard className="h-4 w-4 text-muted-foreground md:h-5 md:w-5" />
            <h1 className="text-base font-semibold tracking-tight md:text-xl">Challenge Promo</h1>
          </div>
        </header>

        <main className="mx-auto w-full max-w-xl flex-1 space-y-5 p-4 pb-16 sm:p-6">
          {/* Récompense */}
          <section
            className="relative overflow-hidden rounded-3xl border border-primary/30 p-6"
            style={{ background: "linear-gradient(135deg, oklch(0.32 0.1 258), oklch(0.16 0.04 265))", boxShadow: "var(--shadow-glow)" }}
          >
            <Gift className="mb-3 h-7 w-7 text-white/90" />
            <h2 className="text-[26px] font-bold leading-tight tracking-tight text-white">
              Un mois d'abonnement offert
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/75">
              Faites une vidéo avec notre démo, atteignez{" "}
              <b className="text-white">{CHALLENGE_MIN_VIEWS.toLocaleString("fr-FR")} vues en {CHALLENGE_WINDOW_DAYS} jours</b>, et c'est gagné.
            </p>
          </section>

          {/* Barre d'étapes */}
          <nav aria-label="Étapes" className="grid grid-cols-3 gap-2">
            {STEPS.map((label, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => i <= step && setStep(i)}
                  className="text-left"
                  aria-current={active ? "step" : undefined}
                >
                  <div className={`h-1.5 rounded-full transition-colors ${done || active ? "bg-primary" : "bg-secondary"}`} />
                  <p className={`mt-2 flex items-center gap-1.5 text-xs ${active ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                    {done ? (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <span className="tabular-nums">{i + 1}</span>
                    )}
                    {label}
                  </p>
                </button>
              );
            })}
          </nav>

          {/* Étape 1 : démo */}
          {step === 0 && (
            <section className={`${card} space-y-4`}>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Choisissez votre vidéo de démo</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Téléchargez-la, puis ajoutez votre voix off et votre montage.
                </p>
              </div>

              {demos.length === 0 && (
                <div className="rounded-2xl bg-secondary/40 px-4 py-6 text-center text-sm text-muted-foreground">
                  Les vidéos de démo arrivent bientôt.
                </div>
              )}

              <div className="space-y-2.5">
                {demos.map((d) => {
                  const selected = demoId === d.id;
                  return (
                    <div
                      key={d.id}
                      onClick={() => setDemoId(d.id)}
                      className={`cursor-pointer rounded-2xl border p-3.5 transition ${
                        selected ? "border-primary bg-primary/10" : "border-border/60 bg-secondary/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium leading-snug">{d.title}</p>
                          {d.description && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{d.description}</p>
                          )}
                        </div>
                        {selected && <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />}
                      </div>
                      <a
                        href={d.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        onClick={(e) => e.stopPropagation()}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground"
                      >
                        <Download className="h-3.5 w-3.5" /> Télécharger
                      </a>
                    </div>
                  );
                })}
              </div>

              <button type="button" onClick={() => setStep(1)} className={`${primaryBtn} w-full`}>
                Continuer <ArrowRight className="h-4 w-4" />
              </button>
            </section>
          )}

          {/* Étape 2 : publication */}
          {step === 1 && (
            <section className={`${card} space-y-4`}>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Publiez votre vidéo</h2>
                <p className="mt-1 text-sm text-muted-foreground">Trois choses à retenir avant d'envoyer votre demande.</p>
              </div>
              <ol className="space-y-3 text-sm">
                {[
                  "Ajoutez votre voix off et votre montage sur la démo.",
                  "Publiez sur TikTok, YouTube Shorts, Instagram ou Facebook.",
                  `Atteignez ${CHALLENGE_MIN_VIEWS.toLocaleString("fr-FR")} vues en ${CHALLENGE_WINDOW_DAYS} jours maximum.`,
                ].map((t, i) => (
                  <li key={i} className="flex gap-3 rounded-2xl bg-secondary/30 p-3.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{t}</span>
                  </li>
                ))}
              </ol>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(0)} className={ghostBtn} aria-label="Retour">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setStep(2)} className={primaryBtn}>
                  J'ai atteint l'objectif <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          {/* Étape 3 : preuve */}
          {step === 2 && (
            <section className={`${card} space-y-4`}>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Envoyez votre preuve</h2>
                <p className="mt-1 text-sm text-muted-foreground">Nous vérifions chaque demande rapidement.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Lien de votre vidéo publiée</label>
                <input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.tiktok.com/…"
                  className={field}
                  inputMode="url"
                  autoCapitalize="none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Date de publication</label>
                  <input type="date" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} className={field} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Vues atteintes</label>
                  <input
                    value={views}
                    onChange={(e) => setViews(e.target.value.replace(/\D/g, ""))}
                    placeholder="3000"
                    className={field}
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FileTile title="Capture de la vidéo" hint="Image, 5 Mo max" file={shot} onPick={pick(setShot)} />
                <FileTile title="Capture des statistiques" hint="Là où on voit les vues" file={stats} onPick={pick(setStats)} />
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(1)} className={ghostBtn} aria-label="Retour">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => void onSubmit()} disabled={sending} className={primaryBtn}>
                  <Send className="h-4 w-4" /> {sending ? "Envoi en cours…" : "Envoyer ma demande"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Toute fausse capture entraîne le refus de la demande.</p>
            </section>
          )}

          {/* Mes demandes */}
          {mine.length > 0 && (
            <section className={`${card} space-y-3`}>
              <h2 className="text-lg font-semibold tracking-tight">Mes demandes</h2>
              {mine.map((s) => (
                <div key={s.id} className="space-y-1.5 rounded-2xl bg-secondary/30 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {s.platform} – {s.claimed_views.toLocaleString("fr-FR")} vues
                    </span>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{s.video_url}</p>
                  {s.status === "rejected" && s.reject_reason && (
                    <p className="text-xs text-destructive">Motif : {s.reject_reason}</p>
                  )}
                </div>
              ))}
            </section>
          )}
        </main>
      </div>

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
      {plansOpen && <PlansSheet onClose={() => setPlansOpen(false)} />}
    </div>
  );
}
