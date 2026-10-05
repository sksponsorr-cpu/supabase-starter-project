import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Clapperboard, Download, Send, Clock, CheckCircle2, XCircle } from "lucide-react";
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
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
        <CheckCircle2 className="w-3.5 h-3.5" /> Acceptée
      </span>
    );
  if (status === "rejected")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
        <XCircle className="w-3.5 h-3.5" /> Refusée
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
      <Clock className="w-3.5 h-3.5" /> En vérification
    </span>
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
        void refresh();
      } else {
        toast.error(res.message);
      }
    } catch (e: any) {
      toast.error(e?.message || "Envoi impossible, réessayez.");
    } finally {
      setSending(false);
    }
  };

  const input = "w-full rounded-xl bg-secondary/50 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} onOpenPlans={() => setPlansOpen(true)} />

      <div className={`flex-1 transition-all flex flex-col overflow-x-hidden ${isCollapsed ? "md:pl-16" : "md:pl-60"}`}>
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/40 px-4 py-3 md:px-6 md:py-4 pl-16 md:pl-6">
          <div className="flex items-center gap-2">
            <Clapperboard className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
            <h1 className="text-base sm:text-lg md:text-xl font-semibold">Challenge Promo</h1>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-2xl w-full mx-auto space-y-4">
          <section className="rounded-2xl border border-border bg-card/40 p-4 space-y-2">
            <h2 className="font-semibold">Comment ça marche</h2>
            <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
              <li>Téléchargez une vidéo de démo officielle ci-dessous.</li>
              <li>Ajoutez votre voix off et votre montage, puis publiez sur TikTok ou YouTube Shorts.</li>
              <li>
                Si votre vidéo atteint <b>{CHALLENGE_MIN_VIEWS.toLocaleString("fr-FR")} vues en {CHALLENGE_WINDOW_DAYS} jours maximum</b>,
                envoyez votre demande ci-dessous.
              </li>
              <li>Après vérification, vous gagnez 1 mois d'abonnement offert.</li>
            </ol>
          </section>

          <section className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
            <h2 className="font-semibold">Vidéos de démo</h2>
            {demos.length === 0 && <p className="text-sm text-muted-foreground">Les vidéos arrivent bientôt.</p>}
            {demos.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/40 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{d.title}</p>
                  {d.description && <p className="text-xs text-muted-foreground line-clamp-2">{d.description}</p>}
                </div>
                <a
                  href={d.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                >
                  <Download className="w-3.5 h-3.5" /> Télécharger
                </a>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
            <h2 className="font-semibold">Envoyer ma demande</h2>

            <label className="block text-xs text-muted-foreground">Vidéo de démo utilisée (facultatif)</label>
            <select value={demoId} onChange={(e) => setDemoId(e.target.value)} className={input}>
              <option value="">Je ne sais pas / autre</option>
              {demos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>

            <label className="block text-xs text-muted-foreground">Lien de ma vidéo publiée</label>
            <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.tiktok.com/..." className={input} inputMode="url" />

            <label className="block text-xs text-muted-foreground">Date de publication</label>
            <input type="date" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} className={input} />

            <label className="block text-xs text-muted-foreground">Nombre de vues atteint en {CHALLENGE_WINDOW_DAYS} jours</label>
            <input value={views} onChange={(e) => setViews(e.target.value.replace(/\D/g, ""))} placeholder="3000" className={input} inputMode="numeric" />

            <label className="block text-xs text-muted-foreground">Capture d'écran de la vidéo</label>
            <input type="file" accept="image/*" onChange={pick(setShot)} className="block w-full text-sm" />

            <label className="block text-xs text-muted-foreground">Capture d'écran des statistiques (vues)</label>
            <input type="file" accept="image/*" onChange={pick(setStats)} className="block w-full text-sm" />

            <button
              onClick={() => void onSubmit()}
              disabled={sending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              <Send className="w-4 h-4" /> {sending ? "Envoi en cours..." : "Envoyer ma demande"}
            </button>
            <p className="text-xs text-muted-foreground">Toute fausse capture entraîne le refus de la demande.</p>
          </section>

          {mine.length > 0 && (
            <section className="rounded-2xl border border-border bg-card/40 p-4 space-y-2">
              <h2 className="font-semibold">Mes demandes</h2>
              {mine.map((s) => (
                <div key={s.id} className="rounded-xl bg-secondary/40 px-3 py-2.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {s.platform} · {s.claimed_views.toLocaleString("fr-FR")} vues
                    </span>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{s.video_url}</p>
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
