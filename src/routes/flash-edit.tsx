import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Check, Sparkles, ShieldCheck, Upload } from "lucide-react";
import { createFlashEdit } from "@/lib/flash-edit.functions";
import { presignAiUpload } from "@/lib/ai-tools.functions";
import { supabase } from "@/integrations/supabase/client";
import { wan30Credits, type ResolutionWan } from "@/lib/pricing/video-edit-pricing";
import { CAMERA_MOVES, composePrompt } from "@/lib/flash-edit/camera-moves";
import { trimVideoTo } from "@/lib/flash-edit/trim-video";

/** Flash Edit : parcours en 4 étapes, aux couleurs de Sam Flash. */
export const Route = createFileRoute("/flash-edit")({
  head: () => ({ meta: [{ title: "Flash Edit — Sam flash 2.0" }] }),
  component: FlashEditPage,
});

const MAX_SOURCE = 15;
const MAX_TOTAL = 30;
const STEPS = ["Vidéo", "Caméra", "Modification", "Lancer"] as const;

const SUGGESTIONS = ["Ambiance nocturne bleutée", "Couleurs chaudes", "Décor urbain", "Lumière douce", "Contrastes cinéma"];

const RESOLUTIONS: { value: ResolutionWan; label: string }[] = [
  { value: "480P", label: "Standard" },
  { value: "720P", label: "Bonne qualité" },
  { value: "1080P", label: "Haute" },
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
const ENTER = "fx .45s cubic-bezier(.2,.8,.2,1) both";

function FlashEditPage() {
  const start = useServerFn(createFlashEdit);
  const presign = useServerFn(presignAiUpload);
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sourceSeconds, setSourceSeconds] = useState(0);
  const [camera, setCamera] = useState("none");
  const [prompt, setPrompt] = useState("");
  const [resolution, setResolution] = useState<ResolutionWan>("720P");
  const [outputSeconds, setOutputSeconds] = useState(10);
  const [audio, setAudio] = useState(true);
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [trimming, setTrimming] = useState(false);
  const [trimProgress, setTrimProgress] = useState(0);
  const [trimNote, setTrimNote] = useState<string | null>(null);

  const maxOutput = sourceSeconds ? Math.max(2, Math.min(30, MAX_TOTAL - sourceSeconds)) : 30;

  const cost = useMemo(() => {
    if (!sourceSeconds) return null;
    try {
      return wan30Credits({ outputSeconds, inputVideoSeconds: sourceSeconds, resolution });
    } catch {
      return null;
    }
  }, [outputSeconds, sourceSeconds, resolution]);

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

  // Tant qu'une modification est en cours, on relit la liste toutes les 5 secondes.
  useEffect(() => {
    if (!jobs.some((j) => j.status === "running")) return;
    const id = setInterval(() => void loadJobs(), 5000);
    return () => clearInterval(id);
  }, [jobs]);

  const onPickVideo = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setError(null);
    setNotice(null);
    setTrimNote(null);
    if (!picked.type.startsWith("video/")) return setError("Choisis un fichier vidéo depuis ta galerie.");
    const url = URL.createObjectURL(picked);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = async () => {
      const seconds = Math.ceil(probe.duration);
      if (!Number.isFinite(seconds) || seconds < 1) return setError("Durée de la vidéo illisible.");
      if (seconds > MAX_SOURCE) {
        // Trop longue : on garde les 15 premières secondes, sans refuser.
        setTrimming(true);
        setTrimProgress(0);
        try {
          const trimmed = await trimVideoTo(picked, MAX_SOURCE, setTrimProgress);
          setFile(trimmed);
          setPreview(URL.createObjectURL(trimmed));
          setSourceSeconds(MAX_SOURCE);
          setOutputSeconds((current) => Math.min(current, MAX_TOTAL - MAX_SOURCE));
          setTrimNote(`Ta vidéo dure ${seconds} s. Les ${MAX_SOURCE} premières secondes ont été gardées.`);
        } catch {
          setError("Impossible de découper cette vidéo. Essaie avec une vidéo plus courte.");
        } finally {
          setTrimming(false);
        }
        return;
      }
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

  const next = () => {
    if (step === 0 && (!file || !sourceSeconds)) return setError("Choisis d'abord une vidéo.");
    if (step === 2 && prompt.trim().length < 3 && camera === "none") return setError("Décris la modification, ou choisis un mouvement de caméra.");
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (!file || !sourceSeconds) return setError("Choisis d'abord une vidéo.");
    if (!rights) return setError("Coche la déclaration de droits pour lancer.");
    const composed = composePrompt(camera, prompt);
    if (composed.length < 3) return setError("Décris la modification souhaitée.");
    setBusy(true);
    try {
      const sourceUrl = await uploadVideo(file);
      const r = await start({
        data: { sourceUrl, sourceSeconds, outputSeconds, resolution, prompt: composed, audio, rightsAccepted: true },
      });
      if (!r.ok) throw new Error(r.message ?? "Lancement impossible.");
      setNotice("Ta vidéo est en cours de création. Tu la retrouveras en bas de page.");
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
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-sky-50 px-5 pb-16 pt-6 text-slate-900">
      <style>{`@keyframes fx{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}`}</style>
      <div className="mx-auto max-w-xl space-y-6">
        <Link to="/outils-ai" className="inline-flex items-center gap-2 text-sm text-slate-500">
          <ArrowLeft className="h-4 w-4" /> Retour aux outils
        </Link>

        <header>
          <h1 className="text-4xl font-semibold tracking-tight text-blue-900">Flash Edit</h1>
          <p className="mt-2 text-[15px] text-slate-500">Modifie une vidéo dont tu détiens les droits.</p>
        </header>

        <ol className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 flex-col gap-2">
              <div className={`h-1.5 rounded-full transition-all duration-500 ${i <= step ? "bg-blue-600" : "bg-blue-100"}`} />
              <span className={`text-xs font-medium transition-colors duration-300 ${i === step ? "text-blue-700" : "text-slate-400"}`}>
                {i < step ? <Check className="mr-1 inline h-3 w-3" /> : null}
                {label}
              </span>
            </li>
          ))}
        </ol>

        <section key={step} style={{ animation: ENTER }} className="space-y-5 rounded-[28px] bg-white p-6 shadow-lg shadow-blue-100/60 ring-1 ring-blue-100">
          {step === 0 && (
            <>
              <div>
                <h2 className="text-xl font-semibold text-blue-900">Choisis ta vidéo</h2>
                <p className="mt-1 text-sm text-slate-500">Maximum 15 secondes.</p>
              </div>
              <label
                htmlFor="flash-file"
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl bg-blue-600 px-6 py-8 text-center text-white shadow-md shadow-blue-300/60 transition duration-300 hover:bg-blue-700 active:scale-[.99]"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
                  <Upload className="h-6 w-6" />
                </span>
                <span className="text-base font-semibold">{file ? "Changer de vidéo" : "Choisir depuis la galerie"}</span>
              </label>
              <input id="flash-file" type="file" accept="video/*" onChange={onPickVideo} className="sr-only" />
              {trimming && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-blue-900">Découpe de ta vidéo en cours… {trimProgress}%</p>
                  <div className="h-2 overflow-hidden rounded-full bg-blue-100">
                    <div className="h-full rounded-full bg-blue-600 transition-all duration-300" style={{ width: `${trimProgress}%` }} />
                  </div>
                </div>
              )}
              {trimNote && <p className="rounded-2xl bg-blue-50 p-3 text-sm text-blue-900">{trimNote}</p>}
              {preview && (
                <div className="space-y-2">
                  <video src={preview} controls playsInline className="max-h-72 w-full rounded-2xl bg-black" />
                  <p className="text-sm text-slate-500">Durée : {sourceSeconds} s</p>
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <h2 className="text-xl font-semibold text-blue-900">Angle de caméra</h2>
                <p className="mt-1 text-sm text-slate-500">Touche un mouvement. Facultatif.</p>
              </div>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
                {CAMERA_MOVES.map((move) => {
                  const selected = camera === move.id;
                  return (
                    <button
                      key={move.id}
                      type="button"
                      onClick={() => setCamera(move.id)}
                      className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition duration-300 active:scale-95 ${
                        selected ? "bg-blue-600 text-white shadow-md shadow-blue-300/60" : "bg-blue-50 text-blue-800 hover:bg-blue-100"
                      }`}
                    >
                      {move.label}
                    </button>
                  );
                })}
              </div>
              <p className="rounded-2xl bg-blue-50 p-3 text-sm text-blue-900">
                {CAMERA_MOVES.find((m) => m.id === camera)?.hint}
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h2 className="text-xl font-semibold text-blue-900">Ta modification</h2>
                <p className="mt-1 text-sm text-slate-500">Ambiance, couleurs, décor.</p>
              </div>
              <textarea
                className="w-full rounded-2xl border border-blue-100 bg-blue-50/40 p-4 text-[15px] outline-none transition focus:border-blue-500 focus:bg-white"
                rows={4}
                maxLength={4000}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex. : ambiance nocturne bleutée, rues mouillées"
              />
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPrompt((p) => (p ? `${p}, ${s.toLowerCase()}` : s))}
                    className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800 transition hover:bg-blue-100 active:scale-95"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <h2 className="text-xl font-semibold text-blue-900">Lancer</h2>
              </div>

              <div className="flex items-center gap-2 rounded-2xl bg-blue-50 p-1">
                {RESOLUTIONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setResolution(r.value)}
                    className={`flex-1 rounded-xl py-2 text-sm font-medium transition duration-300 ${
                      resolution === r.value ? "bg-blue-600 text-white shadow" : "text-blue-800"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-4 rounded-2xl bg-blue-50 p-4">
                <span className="text-sm font-semibold text-blue-900">Durée max</span>
                <div className="flex flex-1 items-center justify-end gap-3">
                  <input
                    type="range"
                    min={2}
                    max={maxOutput}
                    value={Math.min(outputSeconds, maxOutput)}
                    onChange={(e) => setOutputSeconds(Number(e.target.value))}
                    className="w-40 accent-blue-600"
                  />
                  <span className="w-10 text-right text-sm font-semibold text-blue-900">{outputSeconds} s</span>
                </div>
              </div>

              <label className="flex items-center justify-between rounded-2xl bg-blue-50 p-4 text-sm font-medium text-blue-900">
                Garder le son
                <input type="checkbox" checked={audio} onChange={(e) => setAudio(e.target.checked)} className="h-5 w-5 accent-blue-600" />
              </label>

              <label className="flex items-start gap-3 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">
                <input type="checkbox" className="mt-1 h-5 w-5 accent-blue-600" checked={rights} onChange={(e) => setRights(e.target.checked)} />
                <span className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  Je déclare détenir les droits de cette vidéo et de toute personne qui y apparaît.
                </span>
              </label>

              <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 p-4 text-white shadow-md shadow-blue-300/50">
                <span className="text-sm text-white/80">Coût</span>
                <span className="text-2xl font-semibold">{cost !== null ? `${cost} crédits` : "—"}</span>
              </div>
            </>
          )}

          {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {notice && <p className="rounded-2xl bg-blue-50 p-3 text-sm text-blue-800">{notice}</p>}

          <div className="flex items-center justify-between gap-3 pt-2">
            <button type="button" onClick={back} disabled={step === 0} className="rounded-full px-5 py-3 text-sm font-medium text-slate-500 transition disabled:opacity-30">
              Retour
            </button>
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={next} disabled={trimming} className="inline-flex disabled:opacity-40 items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-blue-300/60 transition duration-300 hover:bg-blue-700 active:scale-95">
                Continuer <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || !rights || cost === null}
                onClick={submit}
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-blue-300/60 transition duration-300 hover:bg-blue-700 active:scale-95 disabled:opacity-40"
              >
                <Sparkles className="h-4 w-4" /> {busy ? "Envoi…" : "Lancer"}
              </button>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-blue-900">Mes modifications</h2>
          {jobs.length === 0 && <p className="text-sm text-slate-500">Aucune modification pour l'instant.</p>}
          <ul className="space-y-3">
            {jobs.map((job) => {
              const minutes = Math.max(0, Math.floor((Date.now() - new Date(job.created_at).getTime()) / 60000));
              const running = job.status === "running";
              return (
                <li key={job.id} className="space-y-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-blue-100">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{job.prompt.slice(0, 120)}</p>
                    <span className={`text-xs font-medium ${running ? "text-blue-600" : job.status === "done" ? "text-emerald-600" : "text-red-600"}`}>
                      {statusLabel(job)}
                    </span>
                  </div>

                  {running && (
                    <div className="space-y-2">
                      <div className="h-2 overflow-hidden rounded-full bg-blue-100">
                        <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-blue-500 to-sky-400" />
                      </div>
                      <p className="text-xs text-slate-500">
                        En cours depuis {minutes < 1 ? "moins d'une minute" : `${minutes} min`}. La page se met à jour seule.
                      </p>
                    </div>
                  )}

                  {job.error_message && <p className="text-xs text-red-600">{job.error_message}</p>}

                  {job.status === "done" && job.result_url && (
                    <div className="space-y-2">
                      <video src={job.result_url} controls playsInline className="w-full rounded-2xl bg-black" />
                      <a href={job.result_url} target="_blank" rel="noopener" className="inline-block text-sm font-semibold text-blue-700 underline">
                        Ouvrir la vidéo
                      </a>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
}
