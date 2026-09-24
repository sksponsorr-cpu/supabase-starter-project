import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Play, Trash2, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { Sidebar } from "@/components/samflash/Sidebar";
import { useSidebarStore } from "@/hooks/useSidebarStore";
import { SettingsSheet } from "@/components/samflash/SettingsSheet";
import { PlansSheet } from "@/components/samflash/PlansSheet";
import { MediaViewer } from "@/components/samflash/MediaViewer";
import { useGenerations, type Generation } from "@/hooks/useGenerations";
import { useServerFn } from "@tanstack/react-start";
import { deleteGeneration } from "@/lib/generation.functions";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [{ title: "Historique – Sam Flash 2.0" }],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { session, loading } = useAuth();
  const { items, loading: feedLoading, refresh } = useGenerations(!!session);
  const removeItem = useServerFn(deleteGeneration);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [viewer, setViewer] = useState<Generation | null>(null);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/" });
  }, [loading, session, navigate]);

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
    <div className="flex min-h-screen bg-background">
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} onOpenPlans={() => setPlansOpen(true)} />
      
      <div className={`flex-1 transition-all flex flex-col overflow-x-hidden ${isCollapsed ? "md:pl-16" : "md:pl-60"}`}>
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/40 px-4 py-3 md:px-6 md:py-4 pl-16 md:pl-6">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
            <h1 className="text-base sm:text-lg md:text-xl font-semibold">Historique</h1>
          </div>
        </header>

        <main className="flex-1 py-4 sm:p-6">
          {feedLoading && items.length === 0 ? (
            <div className="flex justify-center py-20"><span className="animate-pulse text-muted-foreground">Chargement...</span></div>
          ) : items.length === 0 ? (
            <div className="flex justify-center py-20 text-muted-foreground">Aucune génération récente.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4 px-2 sm:px-4">
              {items.map((g) => (
                <div
                  key={g.id}
                  className="group relative aspect-[2/3] overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur-xl"
                >
                  <button
                    type="button"
                    aria-label={t("openMedia")}
                    onClick={() => setViewer(g)}
                    className="block h-full w-full text-left"
                  >
                    {g.media_url ? (
                      g.media_type === "video" ? (
                        <video
                          src={g.media_url}
                          muted
                          playsInline
                          preload="metadata"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <img
                          src={g.media_url}
                          alt={g.prompt}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      )
                    ) : (
                      <div className="flex h-full items-center justify-center px-3 text-center text-xs text-muted-foreground bg-secondary/20">
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
                    aria-label="Supprimer"
                    onClick={() => void remove(g.id)}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/70 text-destructive backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-background/70 px-3 py-2 backdrop-blur-md">
                    <p className="text-[11px] font-medium line-clamp-2">{g.prompt}</p>
                    {g.created_at && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(g.created_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

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
  );
}
