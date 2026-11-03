import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Camera, Check, Sparkles, ShieldCheck, Upload } from "lucide-react";
import { createFlashEdit } from "@/lib/flash-edit.functions";
import { presignAiUpload } from "@/lib/ai-tools.functions";
import { supabase } from "@/integrations/supabase/client";
import { wan30Credits, type ResolutionWan } from "@/lib/pricing/video-edit-pricing";

/** Flash Edit : parcours en 4 étapes pour modifier une vidéo dont l'utilisateur détient les droits. */
export const Route = createFileRoute("/flash-edit")({
  head: () => ({ meta: [{ title: "Flash Edit — Sam flash 2.0" }] }),
  component: FlashEditPage,
});

const MAX_SOURCE = 15;
const MAX_TOTAL = 30;
const STEPS = ["Vidéo", "Caméra", "Modification", "Lancer"] as const;

const CAMERA_MOVES = [
  { id: "none", label: "Sans mouvement précis", hint: "Je décris tout moi-même", text: "" },
  { id: "wide", label: "Plan large", hint: "Vue d'ensemble de la scène", text: "wide establishing shot" },
  { id: "close", label: "Gros plan", hint: "Cadrage serré sur le sujet", text: "close-up shot" },
  { id: "push", label: "Travelling avant", hint: "La caméra s'approche", text: "slow dolly push-in" },
  { id: "pull", label: "Travelling arrière", hint: "La caméra s'éloigne", text: "slow dolly pull-out" },
  { id: "orbit", label: "Rotation autour", hint: "La caméra tourne autour du sujet", text: "camera orbiting around the subject" },
  { id: "low", label: "Contre-plongée", hint: "Vue depuis le bas", text: "low-angle shot" },
  { id: "high", label: "Plongée", hint: "Vue depuis le haut", text: "high-angle shot" },
  { id: "track", label: "Plan de suivi", hint: "La caméra suit le mouvement", text: "tracking shot following the subject" },
] as const;

const SUGGESTIONS = ["Ambiance nocturne bleutée", "Couleurs chaudes et dorées", "Décor urbain", "Lumière douce du matin", "Style cinéma, contrastes marqués"];

const RESOLUTIONS: { value: ResolutionWan; label: string; hint: string }[] = [
  { value: "480P", label: "Standard", hint: "Rapide et économique" },
  { value: "720P", label: "Bonne qualité", hint: "Le bon équilibre" },
  { value: "1080P", label: "Haute qualité", hint: "Net, plus coûteux" },
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
  const [camera, setCamera] = useState<(typeof CAMERA_MOVES)[number]["id"]>("none");
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
  const totalSeconds = sourceSeconds + outputSeconds;

  const cost = useMemo(() => {
    if (!sourceSeconds) return null;
    try {
      return wan30Credits({ outputSeconds, inputVideoSeconds: sourceSeconds, resolution });
    } catch {
      return null;
    }
  }, [outputSeconds, sourceSeconds, resolution]);

  const selectedCamera = CAMERA_MOVES.find((c) => c.id === camera) ?? CAMERA_MOVES[0];

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
    e.target.value = "";
    if (!picked) return;
    setError(null);
    setNotice(null);
    if (!picked.type.startsWith("video/")) return setError("Choisis un fichier vidéo depuis ta galerie.");
    const url = URL.createObjectURL(picked);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      const seconds = Math.ceil(probe.duration);
      if (!Number.isFinite(seconds) || seconds < 1) return setError("Durée de la vidéo illisible.");
      if (seconds > MAX_SOURCE) {
        return setError(`Cette vidéo dure ${seconds} s. Choisis une vidéo de ${MAX_SOURCE} secondes maximum.`);
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

  const canGoNext = (): string | null => {
    if (step === 0 && (!file || !sourceSeconds)) return "Choisis d'abord une vidéo.";
    if (step === 2 && prompt.trim().length < 3 && camera === "none") return "Décris la modification souhaitée.";
    return null;
  };

  const next = () => {
    const problem = canGoNext();
    if (problem) return setError(problem);
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
    const description = prompt.trim();
    const composed = [selectedCamera.text ? `Camera: ${selectedCamera.text}.` : "", description].filter(Boolean).join(" ");
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
    <main className="min-h-screen bg-zinc-50 px-5 pb-16 pt-6 text-zinc-900">
      <style>{`@keyframes fx{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}`}</style>
      <div className="mx-auto max-w-xl space-y-6">
        <Link to="/outils-ai" className="inline-flex items-center gap-2 text-sm text-zinc-500">
          <ArrowLeft className="h-4 w-4" /> Retour aux outils
        </Link>

        <header className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight">Flash Edit</h1>
          <p className="text-[15px] text-zinc-500">Modifiez une vidéo dont vous détenez les droits, en quatre étapes.</p>
        </header>

        {/* Progression */}
        <ol className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 flex-col gap-2">
              <div className={`h-1.5 rounded-full transition-all duration-500 ${i <= step ? "bg-zinc-900" : "bg-zinc-200"}`} />
              <span className={`text-xs font-medium transition-colors duration-300 ${i === step ? "text-zinc-900" : "text-zinc-400"}`}>
                {i < step ? <Check className="mr-1 inline h-3 w-3" /> : null}
                {label}
              </span>
            </li>
          ))}
        </ol>

        <section key={step} style={{ animation: ENTER }} className="space-y-5 rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-zinc-100">
          {step === 0 && (
            <>
              <div>
                <h2 className="text-xl font-semibold">Choisis ta vidéo</h2>
                <p className="mt-1 text-sm text-zinc-500">Sélectionne une vidéo dans ta galerie.</p>
              </div>

              <label
                htmlFor="flash-file"
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl bg-zinc-900 px-6 py-8 text-center text-white transition duration-300 hover:scale-[1.01] active:scale-[.99]"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
                  <Upload className="h-6 w-6" />
                </span>
                <span className="text-base font-semibold">{file ? "Changer de vidéo" : "Choisir depuis la galerie"}</span>
                <span className="text-xs text-white/70">MP4 ou MOV, 15 secondes maximum</span>
              </label>
              <input id="flash-file" type="file" accept="video/*" onChange={onPickVideo} className="sr-only" />

              {preview && (
                <div className="space-y-2">
                  <video src={preview} controls playsInline className="max-h-72 w-full rounded-2xl bg-black" />
                  <p className="text-sm text-zinc-500">Durée : {sourceSeconds} s</p>
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <h2 className="text-xl font-semibold">Choisis le mouvement de caméra</h2>
                <p className="mt-1 text-sm text-zinc-500">Touche une option. Tu pourras préciser ensuite.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {CAMERA_MOVES.map((move) => {
                  const selected = camera === move.id;
                  return (
                    <button
                      key={move.id}
                      type="button"
                      onClick={() => setCamera(move.id)}
                      className={`flex flex-col gap-1 rounded-2xl p-4 text-left transition duration-300 active:scale-95 ${
                        selected ? "bg-zinc-900 text-white shadow-lg" : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <Camera className="h-4 w-4" /> {move.label}
                      </span>
                      <span className={`text-xs ${selected ? "text-white/70" : "text-zinc-500"}`}>{move.hint}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h2 className="text-xl font-semibold">Décris la modification</h2>
                <p className="mt-1 text-sm text-zinc-500">Ambiance, couleurs, décor. Facultatif si tu as choisi un mouvement de caméra.</p>
              </div>
              <textarea
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-[15px] outline-none transition focus:border-zinc-900 focus:bg-white"
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
                    className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-200 active:scale-95"
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
                <h2 className="text-xl font-semibold">Réglages et lancement</h2>
                <p className="mt-1 text-sm text-zinc-500">Choisis la qualité et la durée du résultat.</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Qualité</p>
                <div className="grid grid-cols-3 gap-2">
                  {RESOLUTIONS.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setResolution(r.value)}
                      className={`rounded-2xl p-3 text-left transition duration-300 active:scale-95 ${
                        resolution === r.value ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-900"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{r.label}</span>
                      <span className={`block text-[11px] ${resolution === r.value ? "text-white/70" : "text-zinc-500"}`}>{r.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 rounded-2xl bg-zinc-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">Durée du résultat</span>
                  <span className="font-semibold">{outputSeconds} s</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={maxOutput}
                  value={Math.min(outputSeconds, maxOutput)}
                  onChange={(e) => setOutputSeconds(Number(e.target.value))}
                  className="w-full accent-zinc-900"
                />
                <div className="space-y-1.5">
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className="h-full rounded-full bg-zinc-900 transition-all duration-500"
                      style={{ width: `${Math.min(100, (totalSeconds / MAX_TOTAL) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-500">
                    Source {sourceSeconds} s + résultat {outputSeconds} s = {totalSeconds} s sur {MAX_TOTAL} s maximum.
                  </p>
                </div>
              </div>

              <label className="flex items-center justify-between rounded-2xl bg-zinc-50 p-4 text-sm font-medium">
                Garder le son
                <input type="checkbox" checked={audio} onChange={(e) => setAudio(e.target.checked)} className="h-5 w-5 accent-zinc-900" />
              </label>

              <label className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-4 text-sm">
                <input type="checkbox" className="mt-1 h-5 w-5 accent-zinc-900" checked={rights} onChange={(e) => setRights(e.target.checked)} />
                <span className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                  Je déclare détenir les droits de cette vidéo et de toute personne qui y apparaît.
                </span>
              </label>

              <div className="flex items-center justify-between rounded-2xl bg-zinc-900 p-4 text-white">
                <span className="text-sm text-white/70">Coût estimé</span>
                <span className="text-2xl font-semibold">{cost !== null ? `${cost} crédits` : "—"}</span>
              </div>
            </>
          )}

          {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {notice && <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={back}
              disabled={step === 0}
              className="rounded-full px-5 py-3 text-sm font-medium text-zinc-500 transition disabled:opacity-30"
            >
              Retour
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={next}
                className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition duration-300 active:scale-95"
              >
                Continuer <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || !rights || cost === null}
                onClick={submit}
                className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition duration-300 active:scale-95 disabled:opacity-40"
              >
                <Sparkles className="h-4 w-4" /> {busy ? "Envoi…" : "Lancer la modification"}
              </button>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Mes modifications</h2>
          {jobs.length === 0 && <p className="text-sm text-zinc-500">Aucune modification pour l'instant.</p>}
          <ul className="space-y-3">
            {jobs.map((job) => (
              <li key={job.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{job.prompt.slice(0, 120)}</p>
                  <span className="text-xs text-zinc-500">{statusLabel(job)}</span>
                </div>
                {job.error_message && <p className="mt-2 text-xs text-red-600">{job.error_message}</p>}
                {job.status === "done" && job.result_url && (
                  <a href={job.result_url} target="_blank" rel="noopener" className="mt-2 inline-block text-sm font-semibold underline">
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
