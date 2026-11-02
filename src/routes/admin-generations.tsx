import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listLostGenerations, recoverLostGeneration } from "@/lib/lost-generations.functions";

/** Vidéos non livrées : voir et récupérer. Réservé au propriétaire. */
export const Route = createFileRoute("/admin-generations")({
  head: () => ({ meta: [{ title: "Vidéos non livrées — Sam flash" }] }),
  component: AdminGenerationsPage,
});

type Row = {
  id: string;
  prompt: string;
  status: string;
  error_message: string | null;
  recoverable: boolean;
  created_at: string;
  duration: string | null;
};

const fmtDate = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function AdminGenerationsPage() {
  const list = useServerFn(listLostGenerations);
  const recover = useServerFn(recoverLostGeneration);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const r = await list();
    setAllowed(r.ok);
    setRows((r.rows as unknown as Row[]) ?? []);
  }, [list]);

  useEffect(() => {
    void load().catch(() => setAllowed(false));
  }, [load]);

  const check = async (id: string) => {
    setBusyId(id);
    try {
      const r = await recover({ data: { id } });
      setNotes((n) => ({ ...n, [id]: r.message }));
      await load();
    } catch (e) {
      setNotes((n) => ({ ...n, [id]: e instanceof Error ? e.message : "Vérification impossible." }));
    } finally {
      setBusyId(null);
    }
  };

  if (allowed === null) return <p className="p-8 text-center text-sm text-slate-500">Chargement…</p>;
  if (!allowed) return <p className="p-8 text-center text-sm text-slate-500">Accès réservé.</p>;

  const recoverable = rows.filter((r) => r.recoverable).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 text-slate-900">
      <header>
        <h1 className="text-2xl font-black">Vidéos non livrées</h1>
        <p className="text-sm text-slate-500">
          {rows.length} vidéo(s) en attente ou en échec sur 30 jours, dont {recoverable} vérifiable(s) auprès du fournisseur.
          Une vidéo retrouvée est livrée sans être recréditée.
        </p>
      </header>

      {rows.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Aucune vidéo non livrée.</p>}

      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-semibold">{r.prompt.slice(0, 160)}</p>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${r.status === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                {r.status === "error" ? "Échec" : "En attente"}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {fmtDate(r.created_at)}{r.duration ? ` · ${r.duration}` : ""} · {r.recoverable ? "vérifiable" : "non vérifiable (ancienne génération)"}
            </p>
            {r.error_message && <p className="text-xs text-slate-600">{r.error_message}</p>}
            {notes[r.id] && <p className="rounded-2xl bg-slate-50 p-3 text-sm">{notes[r.id]}</p>}
            {r.recoverable && (
              <button type="button" disabled={busyId === r.id} onClick={() => check(r.id)} className="rounded-full bg-blue-700 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
                {busyId === r.id ? "Vérification…" : "Vérifier et récupérer"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
