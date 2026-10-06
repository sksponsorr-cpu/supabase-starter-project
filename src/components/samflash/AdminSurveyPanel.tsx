import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Megaphone, RefreshCw } from "lucide-react";
import { listOnboardingResponses, type OnboardingReport } from "@/lib/onboarding.functions";
import { SOURCE_LABELS } from "@/components/samflash/OnboardingSurvey";
import { EmptyState } from "@/components/samflash/EmptyState";
import { toast } from "@/lib/toast";

const PAGE = 15;
const KEYS = ["youtube", "tiktok", "facebook", "google", "gemini", "other", "ignore"] as const;

/** Réponses au sondage « Comment avez-vous découvert Sam flash ? » (paginées côté écran). */
export function AdminSurveyPanel() {
  const fetchReport = useServerFn(listOnboardingResponses);
  const [report, setReport] = useState<OnboardingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(PAGE);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await fetchReport());
      setVisible(PAGE);
    } catch {
      toast.error("Impossible de charger les réponses.");
      setReport({ total: 0, counts: {}, items: [] });
    } finally {
      setLoading(false);
    }
  }, [fetchReport]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = report?.items ?? [];

  return (
    <section className="pt-5">
      <div className="flex items-center gap-2">
        <h2 className="text-[22px] font-semibold tracking-tight">Acquisition</h2>
        <button
          type="button"
          onClick={() => void load()}
          aria-label="Actualiser"
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-secondary transition-transform active:scale-95"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Réponses à « Comment avez-vous découvert Sam flash ? » ({report?.total ?? 0} au total).
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {KEYS.map((k) => {
          const n = report?.counts[k] ?? 0;
          const pct = report?.total ? Math.round((n / report.total) * 100) : 0;
          return (
            <div key={k} className="rounded-3xl border border-border/70 bg-card/50 p-4 backdrop-blur-xl">
              <p className="text-sm text-muted-foreground">
                {SOURCE_LABELS[k].label}
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{n}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{pct} %</p>
            </div>
          );
        })}
      </div>

      {!loading && items.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={Megaphone}
            title="Aucune réponse pour le moment"
            description="Chaque nouvel utilisateur voit la question une seule fois ; ses réponses s'afficheront ici."
          />
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-3xl border border-border/70 bg-card/50 backdrop-blur-xl">
          <div className="divide-y divide-border/60">
            {items.slice(0, visible).map((r) => (
              <div key={r.user_id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{r.email ?? r.user_id.slice(0, 8)}</span>
                <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-medium">
                  {SOURCE_LABELS[r.source]?.label ?? r.source}
                  {r.source === "other" && r.other_text ? ` : ${r.other_text}` : ""}
                </span>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                  {new Date(r.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </div>
            ))}
          </div>
          {visible < items.length && (
            <div className="border-t border-border/60 p-3 text-center">
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE)}
                className="rounded-full bg-secondary px-6 py-2 text-[13px] font-medium"
              >
                Voir plus ({items.length - visible} restantes)
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
