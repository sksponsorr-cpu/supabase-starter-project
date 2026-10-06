import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageSquareQuote, RefreshCw, Star } from "lucide-react";
import { listReviews, type AppReview, type ReviewPage } from "@/lib/feedback.functions";
import { EmptyState } from "@/components/samflash/EmptyState";
import { timeAgo } from "@/lib/time-ago";
import { toast } from "@/lib/toast";

const PAGE_SIZE = 10;

function Stars({ value, size = "h-4 w-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${size} ${s <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
        />
      ))}
    </span>
  );
}

/** Avis des utilisateurs : note moyenne, répartition et commentaires (paginés). */
export function AdminReviewsPanel() {
  const fetchReviews = useServerFn(listReviews);
  const [items, setItems] = useState<AppReview[]>([]);
  const [stats, setStats] = useState<Pick<ReviewPage, "total" | "average" | "distribution">>({
    total: 0,
    average: 0,
    distribution: {},
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (append = false, offset = 0) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await fetchReviews({ data: { offset, limit: PAGE_SIZE } });
        setItems((prev) => (append ? [...prev, ...res.items] : res.items));
        setStats({ total: res.total, average: res.average, distribution: res.distribution });
      } catch {
        toast.error("Impossible de charger les avis.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [fetchReviews],
  );

  useEffect(() => {
    void load(false, 0);
  }, [load]);

  return (
    <section className="pt-5">
      <div className="flex items-center gap-2">
        <h2 className="text-[22px] font-semibold tracking-tight">Avis des utilisateurs</h2>
        <button
          type="button"
          onClick={() => void load(false, 0)}
          aria-label="Actualiser"
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-secondary transition-transform active:scale-95"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Notes et commentaires envoyés depuis Réglages → Noter l'application.
      </p>

      <div className="mt-4 grid gap-4 rounded-3xl border border-border/70 bg-card/50 p-5 backdrop-blur-xl sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex flex-col items-center justify-center px-2 sm:px-6">
          <p className="text-5xl font-bold tracking-tight">{stats.total ? stats.average.toFixed(1) : "–"}</p>
          <div className="mt-2">
            <Stars value={stats.average} size="h-5 w-5" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {stats.total} avis
          </p>
        </div>
        <div className="space-y-1.5">
          {[5, 4, 3, 2, 1].map((n) => {
            const c = stats.distribution[String(n)] ?? 0;
            const pct = stats.total ? Math.round((c / stats.total) * 100) : 0;
            return (
              <div key={n} className="flex items-center gap-3 text-xs">
                <span className="w-3 text-right text-muted-foreground">{n}</span>
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-right text-muted-foreground">{c}</span>
              </div>
            );
          })}
        </div>
      </div>

      <ul className="mt-4 space-y-3">
        {loading && items.length === 0
          ? Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="h-20 animate-pulse rounded-3xl bg-secondary/50" />
            ))
          : items.map((r) => (
              <li key={r.user_id} className="rounded-3xl border border-border/70 bg-card/50 p-4 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                    {(r.email ?? "?").charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">{r.email ?? "Utilisateur"}</p>
                    <Stars value={r.stars} />
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(r.updated_at)}</span>
                </div>
                {r.comment ? (
                  <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-secondary px-3.5 py-3 text-[14px]">
                    {r.comment}
                  </p>
                ) : (
                  <p className="mt-2 text-[13px] italic text-muted-foreground">Aucun commentaire.</p>
                )}
              </li>
            ))}
      </ul>

      {!loading && items.length === 0 && (
        <div className="mt-4">
          <EmptyState
            icon={MessageSquareQuote}
            title="Aucun avis pour le moment"
            description="Les notes et commentaires de vos utilisateurs apparaîtront ici."
          />
        </div>
      )}

      {items.length > 0 && items.length < stats.total && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void load(true, items.length)}
            className="inline-flex items-center gap-2 rounded-full bg-secondary px-6 py-2.5 text-[13px] font-medium disabled:opacity-60"
          >
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            Voir plus
          </button>
        </div>
      )}
    </section>
  );
}
