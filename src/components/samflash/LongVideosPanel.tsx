import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listLongVideos } from "@/lib/long-jobs.functions";
import { formatDuration } from "@/components/samflash/DurationSlider";

type Job = {
  id: string;
  prompt: string;
  resolution: string;
  target_seconds: number;
  seconds_done: number;
  status: "pending" | "running" | "done" | "failed";
  final_url: string | null;
  error_message: string | null;
};

const LABEL: Record<Job["status"], string> = {
  pending: "En attente",
  running: "En cours",
  done: "Terminée",
  failed: "Échec (crédits rendus)",
};

/** Liste des vidéos longues avec barre de progression, rafraîchie toutes les 5 secondes. */
export function LongVideosPanel() {
  const fetchJobs = useServerFn(listLongVideos);
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () => fetchJobs().then((r) => alive && setJobs(r.jobs as Job[])).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [fetchJobs]);

  if (jobs.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Vidéos longues</h3>
      {jobs.map((job) => {
        const pct = Math.min(100, Math.round((job.seconds_done / job.target_seconds) * 100));
        return (
          <article key={job.id} className="rounded-2xl border border-border p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="line-clamp-1 font-medium">{job.prompt}</span>
              <span className="text-muted-foreground">{LABEL[job.status]}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${job.status === "done" ? 100 : pct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDuration(job.seconds_done)} sur {formatDuration(job.target_seconds)} · {job.resolution}
            </p>
            {job.status === "done" && job.final_url && (
              <video src={job.final_url} controls className="w-full rounded-xl" />
            )}
            {job.status === "failed" && job.error_message && (
              <p className="text-xs text-destructive">{job.error_message}</p>
            )}
          </article>
        );
      })}
    </section>
  );
}
