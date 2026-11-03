import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { createFlashEdit } from "@/lib/flash-edit.functions";
import { presignAiUpload } from "@/lib/ai-tools.functions";
import { supabase } from "@/integrations/supabase/client";
import { wan30Credits, type ResolutionWan } from "@/lib/pricing/video-edit-pricing";

/** Flash Edit : modification d'une vidéo dont l'utilisateur détient les droits. */
export const Route = createFileRoute("/flash-edit")({
  head: () => ({ meta: [{ title: "Flash Edit — Sam flash 2.0" }] }),
  component: FlashEditPage,
});

const MAX_SOURCE = 15;
const MAX_TOTAL = 30;
const RESOLUTIONS: { value: ResolutionWan; label: string }[] = [
  { value: "480P", label: "Standard" },
  { value: "720P", label: "Bonne qualité" },
  { value: "1080P", label: "Haute qualité" },
];

type Job = {
  id: string;
  status: string;
  prompt: string;
  result_url: string | null;
  cost_credits: number;
  error_message: string | null;
  created_at: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function FlashEditPage() {
  const start = useServerFn(createFlashEdit);
  const presign = useServerFn(presignAiUpload);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sourceSeconds, setSourceSeconds] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [resolution, setResolution] = useState<ResolutionWan>("720P");
  const [outputSeconds, setOutputSeconds] = useState(10);
  const [audio, setAudio] = useState(true);
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);

  const maxOutput = sourceSeconds ? Math.max(2, Math.min(30, MAX_TOTAL - sourceSeconds)) : 30;
  let cost: number | null = null;
  if (sourceSeconds) {
    try {
      cost = wan30Credits({ outputSeconds, inputVideoSeconds: sourceSeconds, resolution });
    } catch {
      cost = null;
    }
  }

  const loadJobs = async () => {
    const { data } = await db
      .from("flash_edit_jobs")
      .select("id, status, prompt, result_url, cost_credits, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setJobs((data ?? []) as Job[]);
  };

  useEffect(() => {
    void loadJobs();
  }, []);

  const onPickVideo = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setError(null);
    setNotice(null);
    if (!picked.type.startsWith("video/")) return setError("Choisis un fichier vidéo.");
    const url = URL.createObjectURL(picked);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      const seconds = Math.ceil(probe.duration);
      if (!Number.isFinite(seconds) || seconds < 1) return setError("Durée de la vidéo illisible.");
      if (seconds > MAX_SOURCE) return setError(`Vidéo trop longue : ${MAX_SOURCE} secondes maximum (${seconds} s détectées).`);
      setFile(picked);
      setPreview(url);
      setSourceSeconds(seconds);
      setOutputSeconds((current) => Math.min(current, MAX_TOTAL - seconds));
    };
    probe.onerror = () => setError("Impossible de lire cette vidéo.");
    probe.src = url;
  };

  const uploadVideo = async (picked: File): Promise<string> => {
    const res = await presign({ data: { kind: "video", type: picked.type, size: picked.size } });
    if (!res.ok) throw new Error(res.message ?? "Import impossible.");
    const put = await fetch(res.uploadUrl, { method: "PUT", headers: { "Content-Type": picked.type }, body: picked });
    if (!put.ok) throw new Error("Import impossible. Réessaie.");
    return res.publicUrl as string;
  };

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (!file || !sourceSeconds) return setError("Ajoute une vidéo.");
    if (!rights) return setError("Coche la déclaration de droits pour continuer.");
    if (prompt.trim().length < 3) return setError("Décris la modification souhaitée.");
    setBusy(true);
    try {
      const sourceUrl = await uploadVideo(file);
      const r = await start({
        data: {
          sourceUrl,
          sourceSeconds,
          outputSeconds,
          resolution,
          prompt: prompt.trim(),
          audio,
          rightsAccepted: true,
        },
      });
      if (!r.ok) throw new Error(r.message ?? "Lancement impossible.");
      setNotice("Ta vidéo est en cours de création. Tu la retrouveras ci-dessous.");
      await loadJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lancement impossible.");
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = (job: Job) =>
    job.status === "done" ? "Terminée" : job.status === "failed" ? "Échec, crédits rendus" : "En cours";

  return (
    <main className="min-h-screen bg-background px-5 pb-12 pt-6 text-foreground">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link to="/outils-ai" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour aux outils
        </Link>

        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Flash Edit</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            Modifiez une vidéo dont vous détenez les droits : angles de caméra, couleurs, ambiance, décor.
          </p>
        </header>

        <section className="space-y-4 rounded-3xl bg-white p-6 text-zinc-900 shadow-sm">
          <label className="block text-sm font-semibold">
            Votre vidéo (15 secondes maximum)
            <input type="file" accept="video/*" onChange={onPickVideo} className="mt-2 block w-full text-sm" />
          </label>
          {preview && <video src={preview} controls className="max-h-72 w-full rounded-2xl bg-black" />}

          <label className="block text-sm font-semibold">
            Modification souhaitée
            <textarea
              className="mt-2 w-full rounded-2xl border border-zinc-200 p-3 text-sm font-normal"
              rows={4}
              maxLength={4000}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex. : plan large, caméra qui se rapproche lentement, ambiance nocturne bleutée"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Qualité
              <select
                className="mt-2 w-full rounded-2xl border border-zinc-200 p-3 text-sm font-normal"
                value={resolution}
                onChange={(e) => setResolution(e.target.value as ResolutionWan)}
              >
                {RESOLUTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Durée du résultat : {outputSeconds} s
              <input
                type="range"
                min={2}
                max={maxOutput}
                value={Math.min(outputSeconds, maxOutput)}
                onChange={(e) => setOutputSeconds(Number(e.target.value))}
                className="mt-4 w-full"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={audio} onChange={(e) => setAudio(e.target.checked)} />
            Garder le son
          </label>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={rights} onChange={(e) => setRights(e.target.checked)} />
            <span>Je déclare détenir les droits de cette vidéo et de toute personne qui y apparaît.</span>
          </label>

          <p className="text-sm font-semibold">
            {cost !== null ? `Coût estimé : ${cost} crédits` : "Ajoute une vidéo pour voir le coût."}
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {notice && <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

          <button
            type="button"
            disabled={busy || !file || !rights || cost === null}
            onClick={submit}
            className="w-full rounded-full bg-zinc-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? "Envoi…" : "Lancer la modification"}
          </button>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Mes modifications</h2>
          {jobs.length === 0 && <p className="text-sm text-muted-foreground">Aucune modification pour l'instant.</p>}
          <ul className="space-y-3">
            {jobs.map((job) => (
              <li key={job.id} className="rounded-3xl bg-white p-5 text-zinc-900 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{job.prompt.slice(0, 120)}</p>
                  <span className="text-xs text-zinc-500">{statusLabel(job)}</span>
                </div>
                {job.error_message && <p className="mt-2 text-xs text-red-600">{job.error_message}</p>}
                {job.status === "done" && job.result_url && (
                  <a href={job.result_url} target="_blank" rel="noopener" className="mt-2 inline-block text-sm font-semibold text-zinc-900 underline">
                    Ouvrir la vidéo
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
