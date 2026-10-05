import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Copy, Share2, Users, ShoppingBag, Trophy, Clapperboard } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/samflash/Sidebar";
import { useSidebarStore } from "@/hooks/useSidebarStore";
import { SettingsSheet } from "@/components/samflash/SettingsSheet";
import { PlansSheet } from "@/components/samflash/PlansSheet";
import { getMyReferral, type ReferralOverview } from "@/lib/referral.functions";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/parrainage")({
  head: () => ({ meta: [{ title: "Parrainage – Sam Flash 2.0" }] }),
  component: ParrainagePage,
});

function ParrainagePage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const { isCollapsed } = useSidebarStore();
  const fetchReferral = useServerFn(getMyReferral);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [data, setData] = useState<ReferralOverview | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!session) return;
    fetchReferral()
      .then(setData)
      .catch(() => setError(true));
  }, [session, fetchReferral]);

  const link = data ? `${window.location.origin}/?ref=${data.code}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Lien copié !");
    } catch {
      toast.error("Copie impossible, sélectionnez le lien manuellement.");
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Sam Flash",
          text: "Crée des vidéos IA avec Sam Flash !",
          url: link,
        });
        return;
      } catch {
        /* annulé */
      }
    }
    void copy();
  };

  const progress = data ? Math.min(100, Math.round((data.conversionsLast30Days / data.goal) * 100)) : 0;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} onOpenPlans={() => setPlansOpen(true)} />

      <div className={`flex-1 transition-all flex flex-col overflow-x-hidden ${isCollapsed ? "md:pl-16" : "md:pl-60"}`}>
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/40 px-4 py-3 md:px-6 md:py-4 pl-16 md:pl-6">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
            <h1 className="text-base sm:text-lg md:text-xl font-semibold">Parrainage</h1>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-2xl w-full mx-auto space-y-4">
          {error && <p className="text-sm text-destructive">Impossible de charger votre espace parrainage.</p>}
          {!data && !error && <p className="text-sm text-muted-foreground animate-pulse">Chargement...</p>}

          {data && (
            <>
              <section className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
                <h2 className="font-semibold">Votre lien de parrainage</h2>
                <p className="text-sm text-muted-foreground">
                  Partagez ce lien. Chaque personne qui s'inscrit avec, puis achète un abonnement, est comptée pour vous.
                </p>
                <div className="rounded-xl bg-secondary/50 px-3 py-2 text-sm break-all select-all">{link}</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void copy()}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
                  >
                    <Copy className="w-4 h-4" /> Copier
                  </button>
                  <button
                    onClick={() => void share()}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium"
                  >
                    <Share2 className="w-4 h-4" /> Partager
                  </button>
                </div>
              </section>

              <section className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border bg-card/40 p-4">
                  <Users className="w-5 h-5 text-muted-foreground mb-2" />
                  <p className="text-2xl font-semibold">{data.signups}</p>
                  <p className="text-xs text-muted-foreground">Inscriptions</p>
                </div>
                <div className="rounded-2xl border border-border bg-card/40 p-4">
                  <ShoppingBag className="w-5 h-5 text-muted-foreground mb-2" />
                  <p className="text-2xl font-semibold">{data.conversions}</p>
                  <p className="text-xs text-muted-foreground">Abonnements achetés</p>
                </div>
              </section>

              <Link
                to="/challenge"
                className="flex items-center gap-3 rounded-2xl border border-border bg-card/40 p-4"
              >
                <Clapperboard className="w-6 h-6 text-primary shrink-0" />
                <div>
                  <p className="font-semibold">Challenge Promo</p>
                  <p className="text-sm text-muted-foreground">
                    Publiez une vidéo de démo, atteignez 3 000 vues en 3 jours et gagnez un abonnement offert.
                  </p>
                </div>
              </Link>

              <section className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold">Palier « Membre d'équipe »</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Faites acheter un abonnement à {data.goal} personnes en 30 jours pour devenir membre d'équipe.
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-sm">
                  {data.conversionsLast30Days} / {data.goal} sur les 30 derniers jours
                </p>
                {data.teamEligibleAt && (
                  <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium">
                    Bravo ! Vous avez atteint l'objectif. Notre équipe va activer votre statut de membre d'équipe.
                  </p>
                )}
              </section>
            </>
          )}
        </main>
      </div>

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
      {plansOpen && <PlansSheet onClose={() => setPlansOpen(false)} />}
    </div>
  );
}
