import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "@/lib/toast";
import { ChevronRight, Play, Share2, Sparkles, Trash2, Menu, CheckCircle2, X, Clapperboard } from "lucide-react";
import { submitToGallery } from "@/lib/community.functions";
import { deleteGeneration } from "@/lib/generation.functions";
import { registerDevice } from "@/lib/device.functions";
import { getDeviceFingerprint } from "@/lib/device";
import { getOrderStatus } from "@/lib/payments.functions";
import { playChime } from "@/lib/chime";
import { SupportReplyNotifier } from "@/components/samflash/SupportReplyNotifier";
import { VideoTile, warmVideo } from "@/components/samflash/VideoTile";

import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { SettingsSheet } from "@/components/samflash/SettingsSheet";
import { Sidebar } from "@/components/samflash/Sidebar";
import { useSidebarStore } from "@/hooks/useSidebarStore";
import { updateProjectTitle } from "@/lib/project.functions";
import { PromptBar } from "@/components/samflash/PromptBar";
import { PlansSheet } from "@/components/samflash/PlansSheet";
import { useGenerations, type Generation } from "@/hooks/useGenerations";
import { PendingCard } from "@/components/samflash/PendingCard";
import { PromoBanner } from "@/components/samflash/PromoBanner";
import { OnboardingSurvey } from "@/components/samflash/OnboardingSurvey";
import { notifOn, optionOn, publishPrefs, usePrefs, vibrate } from "@/lib/prefs";
import { takePrefill } from "@/lib/prefill";
import { MediaViewer } from "@/components/samflash/MediaViewer";
import { EmptyState } from "@/components/samflash/EmptyState";
import logoAsset from "@/assets/sam-flash-logo.png";

export const Route = createFileRoute("/app")({
  validateSearch: (s: Record<string, unknown>): { project?: string; welcome_order?: string } => ({
    project: typeof s["project"] === "string" ? s["project"] : undefined,
    welcome_order: typeof s["welcome_order"] === "string" ? s["welcome_order"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sam flash 2.0 — Studio de création IA" },
      {
        name: "description",
        content:
          "Studio Sam flash 2.0 : décrivez votre idée et générez des vidéos et images IA en quelques secondes.",
      },
      { property: "og:title", content: "Sam flash 2.0 — Studio de création IA" },
      {
        property: "og:description",
        content: "Décrivez votre idée et générez vidéos et images IA avec Sam flash 2.0.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AppFeed,
});

function AppFeed() {
  const { isCollapsed } = useSidebarStore();
  const search = Route.useSearch();
  const welcomeOrderId = search?.welcome_order;
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [cancelFn, setCancelFn] = useState<(() => void) | null>(null);
  const [pending, setPending] = useState<{ prompt: string; mediaType: "image" | "video" } | null>(
    null,
  );
  const [viewer, setViewer] = useState<Generation | null>(null);
  const [visibleCount, setVisibleCount] = useState(12);
  const navigate = useNavigate();
  const { t } = useI18n();
  const { session, loading, profile } = useAuth();
  const prefs = usePrefs();
  const [prefill, setPrefill] = useState<{ text: string; nonce: number } | null>(null);
  const { items, loading: feedLoading, refresh } = useGenerations(!!session);
  const submit = useServerFn(submitToGallery);
  const removeItem = useServerFn(deleteGeneration);
  const saveDevice = useServerFn(registerDevice);
  const checkOrderStatus = useServerFn(getOrderStatus);

  // Initialisation côté navigateur uniquement (chargée dynamiquement pour éviter le build serveur).
  useEffect(() => {
    void import("@/init-browser").then((m) => m.initializeAll());
  }, []);

  // Préférences du compte → toute l'application (haptique, notifications, compétences…).
  useEffect(() => {
    if (profile?.preferences) publishPrefs(profile.preferences);
  }, [profile]);

  // Retour haptique sur chaque bouton / lien, si activé dans les paramètres.
  useEffect(() => {
    if (prefs.haptics === false) return;
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest("button, a, [role='button']")) vibrate(10);
    };
    document.addEventListener("click", onClick, { passive: true });
    return () => document.removeEventListener("click", onClick);
  }, [prefs.haptics]);

  // Prompt réutilisé depuis la galerie ou la visionneuse.
  useEffect(() => {
    const stashed = takePrefill();
    if (stashed) setPrefill({ text: stashed, nonce: Date.now() });
    const onPrefill = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      if (text) setPrefill({ text, nonce: Date.now() });
    };
    window.addEventListener("samflash:prefill", onPrefill);
    return () => window.removeEventListener("samflash:prefill", onPrefill);
  }, []);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/" });
  }, [loading, session, navigate]);

  // Enregistre l'appareil : l'offre gratuite reste limitée à un compte par téléphone.
  useEffect(() => {
    if (!session) return;
    void saveDevice({ data: { fingerprint: getDeviceFingerprint() } }).catch(() => undefined);
  }, [session, saveDevice]);

  // Si redirection depuis checkout.success avec un ID de commande, on vérifie côté serveur
  useEffect(() => {
    if (!welcomeOrderId || !session) return;

    let cancel = false;
    checkOrderStatus({ data: { transactionId: welcomeOrderId } })
      .then((res) => {
        if (cancel) return;
        if (res.ok && res.order.status === "payee") {
          const label = (res.order as any).planLabel || "Super Grok";
          window.dispatchEvent(new CustomEvent("subscription-updated", { detail: { planLabel: label } }));
          void navigate({
            to: "/app",
            search: (prev: any) => {
              const nextSearch = { ...prev };
              delete nextSearch.welcome_order;
              return nextSearch;
            },
            replace: true,
          });
        }
      })
      .catch(() => {});

    return () => {
      cancel = true;
    };
  }, [welcomeOrderId, session, checkOrderStatus, navigate]);

  // Écoute de l'événement de mise à jour d'abonnement (déclenché aussi depuis CheckoutSheet)
  useEffect(() => {
    const handleSubUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ planLabel?: string }>;
      const label = customEvent.detail?.planLabel || "Super Grok";
      const msg = `Merci d'avoir accédé à ${label}`;
      setWelcomeMessage(msg);
      toast.success(msg);
      playChime("success");
      void refresh();
    };

    window.addEventListener("subscription-updated", handleSubUpdate);
    return () => window.removeEventListener("subscription-updated", handleSubUpdate);
  }, [refresh]);

  const share = async (id: string) => {
    try {
      await submit({ data: { id, consent: true } });
      toast.success(t("shareOk"));
    } catch {
      toast.error(t("shareErr"));
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Supprimer définitivement cette création ?")) return;
    try {
      const result = await removeItem({ data: { id } });
      if (result.ok) {
        toast.success("Création supprimée.");
        void refresh();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Suppression impossible.");
    }
  };

  return (
    <div
      className="flex min-h-screen bg-background"
      style={{ background: "var(--gradient-hero)" }}
    >
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} onOpenPlans={() => setPlansOpen(true)} />

      <div className={`flex-1 transition-all flex flex-col overflow-x-hidden ${isCollapsed ? "md:pl-16" : "md:pl-60"}`}>
        <PromoBanner enabled={!!session && notifOn(prefs, "offers")} />

        {welcomeMessage && (
          <div className="mx-auto mt-4 max-w-2xl px-4 w-full animate-fade-in">
            <div className="relative flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400 backdrop-blur-xl shadow-lg">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                <span>{welcomeMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setWelcomeMessage(null)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <div className="pt-16 md:pt-0 mt-4 md:mt-12 flex flex-col items-center px-4">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight mb-2 text-center">Qu'allons-nous créer ?</h1>
          <p className="text-muted-foreground mb-6 md:mb-8 text-center text-[11px] sm:text-xs md:text-sm">Décrivez votre idée et laissez l'IA faire la magie.</p>
        </div>

        <PromptBar
          onStart={(p) => setPending(p)}
          onCancelReady={(fn) => setCancelFn(() => fn)}
          onSettled={() => { setPending(null); setCancelFn(null); }}
          onGenerated={() => void refresh()}
          onQuotaExceeded={() => setPlansOpen(true)}
          prefill={prefill}
        />

        <section className="mt-4 sm:mt-8 px-2 sm:px-4 pb-20">
        <div className="flex items-center gap-2 px-2 sm:px-4 mb-4">
          <h1 className="text-base sm:text-lg md:text-xl font-semibold">{t("myCreations")}</h1>
          <Link
            to="/galerie"
            className="ml-auto rounded-full bg-secondary px-3 py-1.5 text-xs font-medium"
          >
            {t("gallery")}
          </Link>

          <button
            type="button"
            onClick={() => void refresh()}
            aria-label={t("refresh")}
            className="flex items-center gap-1 text-muted-foreground"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4 px-2 sm:px-4">
          {pending && (
            <PendingCard
              prompt={pending.prompt}
              mediaType={pending.mediaType}
              estimate={pending.mediaType === "video" ? 75 : 25}
              onCancel={cancelFn || undefined}
            />
          )}
          {feedLoading && items.length === 0
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[2/3] animate-pulse rounded-2xl border border-border bg-card/40 backdrop-blur-xl"
                />
              ))
            : items.slice(0, visibleCount).map((g) => (
                <div
                  key={g.id}
                  className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur-xl"
                >
                  <button
                    type="button"
                    aria-label={t("openMedia")}
                    onPointerEnter={() => warmVideo(g.media_url)}
                    onTouchStart={() => warmVideo(g.media_url)}
                    onClick={() => setViewer(g)}
                    className="block h-full w-full text-left"
                  >
                    {g.media_url ? (
                      g.media_type === "video" ? (
                        <VideoTile src={g.media_url} className="h-full w-full object-cover" />
                      ) : (
                        <img
                          src={g.media_url}
                          alt={g.prompt}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      )
                    ) : (
                      <div className="flex h-full items-center justify-center px-3 text-center text-xs text-muted-foreground">
                        {g.status === "processing"
                          ? t("processing")
                          : (g.error_message ?? g.prompt)}
                      </div>
                    )}
                  </button>
                  {g.media_type === "video" && g.media_url && (
                    <span className="pointer-events-none absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/70 backdrop-blur-md">
                      <Play className="h-4 w-4" />
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={t("shareGallery")}
                    onClick={() => void share(g.id)}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/70 backdrop-blur-md"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Supprimer la création"
                    onClick={() => void remove(g.id)}
                    className="absolute right-2 top-12 flex h-8 w-8 items-center justify-center rounded-full bg-background/70 text-destructive backdrop-blur-md"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-background/70 px-2 py-1 text-[11px] line-clamp-2 backdrop-blur-md">
                    {g.prompt}
                    {optionOn(prefs, "advancedMode") && (
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {[g.resolution, g.duration, g.aspect_ratio].filter(Boolean).join(" · ")}
                        {optionOn(prefs, "debug") ? ` · #${g.id.slice(0, 8)}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              ))}
          {!feedLoading && items.length === 0 && !pending && (
            <div className="col-span-full">
              <EmptyState
                icon={Clapperboard}
                title="Aucune création pour l'instant"
                description="Décrivez votre idée dans la barre ci-dessus : votre première vidéo ou image apparaîtra ici."
              />
            </div>
          )}
        </div>
        {items.length > visibleCount && (
          <div className="mt-6 flex flex-col items-center gap-2 px-4">
            <p className="text-xs text-muted-foreground">
              {visibleCount} sur {items.length} créations
            </p>
            <button
              type="button"
              onClick={() => setVisibleCount((n) => n + 12)}
              className="rounded-full bg-secondary px-6 py-2.5 text-[13px] font-medium"
            >
              Voir plus
            </button>
          </div>
        )}
        </section>

        <SupportReplyNotifier enabled={!!session} />
        <OnboardingSurvey enabled={!!session} />
        {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
        {plansOpen && <PlansSheet onClose={() => setPlansOpen(false)} />}
        {viewer && (
          <MediaViewer
            item={viewer}
            onClose={() => setViewer(null)}
            onChanged={() => void refresh()}
          />
        )}
      </div>
    </div>
  );
}
