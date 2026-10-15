import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Download, ImagePlus, Loader2, Music, Trash2, Video, XCircle } from "lucide-react";
import { aiAccess } from "@/lib/chat.functions";
import {
  getAiJob,
  listAiJobs,
  presignAiUpload,
  startAiJob,
  type AiJobRow,
} from "@/lib/ai-tools.functions";
import { cancelAiJob, deleteAiJob, expireStaleAiJobs } from "@/lib/ai-jobs-manage.functions";
import {
  AVATAR_MAX_SECONDS,
  CLONE_MAX_SECONDS,
  CLONE_MIN_SECONDS,
  costPerSecond,
  jobCost,
  variantsFor,
  type AiTool,
} from "@/lib/ai-tools-pricing";
import { toast } from "@/lib/toast";

type Phase = "idle" | "uploading" | "starting" | "processing" | "done";

function readDuration(file: File, kind: "audio" | "video"): Promise<number> {
  return new Promise((resolve, reject) => {
    const el = document.createElement(kind === "audio" ? "audio" : "video");
    const url = URL.createObjectURL(file);
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(el.duration);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("metadata"));
    };
    el.src = url;
  });
}

function putFile(url: string, file: File, onProgress: (ratio: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("upload")));
    xhr.onerror = () => reject(new Error("upload"));
    xhr.send(file);
  });
}

const STATUS_LABEL: Record<string, string> = {
  pending: "En préparation",
  processing: "En cours",
  success: "Terminée",
  failed: "Échouée (remboursée)",
};

const MOTION_CSS = `
@keyframes fm-rise { from { opacity: 0; transform: translateY(14px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes fm-zoom { from { opacity: 0; transform: scale(.94); } to { opacity: 1; transform: none; } }
@keyframes fm-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
.fm-rise { animation: fm-rise .6s cubic-bezier(.2,.8,.2,1) both; }
.fm-zoom { animation: fm-zoom .7s cubic-bezier(.2,.8,.2,1) both; }
.fm-card { animation: fm-rise .6s cubic-bezier(.2,.8,.2,1) both; transition: transform .25s ease, box-shadow .25s ease; }
.fm-card:hover { transform: translateY(-2px); box-shadow: 0 14px 30px -14px rgba(0,0,0,.55); }
.fm-press { transition: transform .15s ease, opacity .15s ease; }
.fm-press:active:not(:disabled) { transform: scale(.97); }
.fm-shimmer { background-image: linear-gradient(90deg, transparent, rgba(255,255,255,.5), transparent); background-size: 200% 100%; animation: fm-shimmer 1.6s linear infinite; }
@media (prefers-reduced-motion: reduce) {
  .fm-rise, .fm-zoom, .fm-card, .fm-shimmer { animation: none !important; transition: none !important; }
  .fm-card:hover { transform: none; }
}
`;

export function AiToolPage({
  tool,
  title,
  description,
  mediaKind,
  mediaLabel,
  imageLabel,
  promptPlaceholder,
}: {
  tool: AiTool;
  title: string;
  description: string;
  mediaKind: "audio" | "video";
  mediaLabel: string;
  imageLabel: string;
  promptPlaceholder: string;
}) {
  const variants = variantsFor(tool);
  const checkAccess = useServerFn(aiAccess);
  const presign = useServerFn(presignAiUpload);
  const start = useServerFn(startAiJob);
  const poll = useServerFn(getAiJob);
  const list = useServerFn(listAiJobs);

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [variantId, setVariantId] = useState(variants[0].id);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [media, setMedia] = useState<File | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [orientation, setOrientation] = useState<"image" | "video">("image");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [jobs, setJobs] = useState<AiJobRow[]>([]);
  const timer = useRef<number | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const cancel = useServerFn(cancelAiJob);
  const remove = useServerFn(deleteAiJob);
  const expire = useServerFn(expireStaleAiJobs);

  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  const estimate = seconds > 0 ? jobCost(variant, seconds) : null;
  const busy = phase === "uploading" || phase === "starting" || phase === "processing";

  const refreshJobs = () =>
    expire({ data: {} })
      .catch(() => undefined)
      .then(() => list({ data: { tool } }))
      .then(setJobs)
      .catch(() => undefined);

  useEffect(() => {
    checkAccess({})
      .then((r) => setEnabled(r.enabled))
      .catch(() => setEnabled(false));
    void refreshJobs();
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickImage = (file: File | null) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Utilisez une image JPG, PNG ou WebP.");
      return;
    }
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const pickMedia = async (file: File | null) => {
    if (!file) return;
    try {
      const d = await readDuration(file, mediaKind);
      if (tool === "avatar" && d > AVATAR_MAX_SECONDS) {
        toast.error(`L'audio est limité à ${AVATAR_MAX_SECONDS} secondes.`);
        return;
      }
      if (tool === "clone" && (d < CLONE_MIN_SECONDS || d > CLONE_MAX_SECONDS)) {
        toast.error(`La vidéo doit durer entre ${CLONE_MIN_SECONDS} et ${CLONE_MAX_SECONDS} secondes.`);
        return;
      }
      setMedia(file);
      setSeconds(Math.ceil(d * 10) / 10);
    } catch {
      toast.error("Impossible de lire ce fichier.");
    }
  };

  const watch = (jobId: string) => {
    if (timer.current) window.clearInterval(timer.current);
    const startedAt = Date.now();
    timer.current = window.setInterval(async () => {
      try {
        const r = await poll({ data: { jobId } });
        if (!r.ok) return;
        setProgress(r.progress);
        if (r.status === "success") {
          if (timer.current) window.clearInterval(timer.current);
          setResultUrl(r.resultUrl);
          setPhase("done");
          void refreshJobs();
        } else if (r.status === "failed") {
          if (timer.current) window.clearInterval(timer.current);
          setPhase("idle");
          toast.error(r.message ?? "La génération a échoué. Vos crédits ont été remboursés.");
          void refreshJobs();
        } else if (Date.now() - startedAt > 25 * 60 * 1000) {
          if (timer.current) window.clearInterval(timer.current);
          setPhase("idle");
          toast.message?.("Toujours en cours : retrouvez-la dans la liste ci-dessous.");
          void refreshJobs();
        }
      } catch {
        // erreur réseau passagère : on réessaie au prochain tour
      }
    }, 5000);
  };

  const upload = async (file: File, kind: "image" | "audio" | "video") => {
    const p = await presign({ data: { kind, type: file.type, size: file.size } });
    if (!p.ok) throw new Error(p.message);
    await putFile(p.uploadUrl, file, (ratio) => setProgress(Math.round(ratio * 100)));
    return p.publicUrl;
  };

  const submit = async () => {
    if (!image || !media || busy) return;
    setResultUrl(null);
    setProgress(0);
    setPhase("uploading");
    try {
      const imageUrl = await upload(image, "image");
      const mediaUrl = await upload(media, mediaKind);
      setPhase("starting");
      const res = await start({
        data: {
          tool,
          variant: variant.id,
          imageUrl,
          mediaUrl,
          prompt: prompt.trim() || undefined,
          seconds,
          orientation,
        },
      });
      if (!res.ok) {
        toast.error(res.message);
        setPhase("idle");
        return;
      }
      setProgress(0);
      setCurrentJobId(res.jobId);
      setPhase("processing");
      void refreshJobs();
      watch(res.jobId);
    } catch (error) {
      toast.error(error instanceof Error && error.message !== "upload" ? error.message : "Envoi du fichier impossible. Réessayez.");
      setPhase("idle");
    }
  };

  const cancelJob = async (jobId: string) => {
    const r = await cancel({ data: { jobId } });
    if (!r.ok) {
      toast.error(r.message);
    } else {
      toast.message?.("Génération annulée. Vos crédits sont remboursés.");
      if (jobId === currentJobId) {
        if (timer.current) window.clearInterval(timer.current);
        setPhase("idle");
        setCurrentJobId(null);
      }
    }
    void refreshJobs();
  };

  const removeJob = async (jobId: string) => {
    const r = await remove({ data: { jobId } });
    if (!r.ok) toast.error(r.message);
    void refreshJobs();
  };

  const refreshOne = async (jobId: string) => {
    try {
      await poll({ data: { jobId } });
    } finally {
      void refreshJobs();
    }
  };

  if (enabled === false) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <h1 className="text-xl font-semibold">{title} arrive bientôt</h1>
        <p className="text-sm text-muted-foreground">Cette fonctionnalité est en cours de préparation.</p>
        <Link to="/outils-ai" className="rounded-full bg-secondary px-5 py-2 text-sm">
          Retour aux outils
        </Link>
      </main>
    );
  }

  const boxClass = "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/40 p-5 text-center";

  return (
    <main className="min-h-screen bg-background px-5 pb-16 pt-6 text-foreground">
      <style>{MOTION_CSS}</style>
      <div className="mx-auto max-w-xl">
        <Link to="/outils-ai" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Plus outils AI
        </Link>
        <h1 className="fm-rise mt-4 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">{description}</p>

        <div className="mt-6 space-y-4">
          <label className={boxClass}>
            {imagePreview ? (
              <img src={imagePreview} alt="Aperçu" className="h-32 w-32 rounded-xl object-cover" />
            ) : (
              <ImagePlus className="h-7 w-7 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">{image ? image.name : imageLabel}</span>
            <span className="text-xs text-muted-foreground">JPG, PNG ou WebP, 10 Mo maximum</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pickImage(e.target.files?.[0] ?? null)} />
          </label>

          <label className={boxClass}>
            {mediaKind === "audio" ? <Music className="h-7 w-7 text-muted-foreground" /> : <Video className="h-7 w-7 text-muted-foreground" />}
            <span className="text-sm font-medium">{media ? `${media.name} · ${seconds} s` : mediaLabel}</span>
            <span className="text-xs text-muted-foreground">
              {mediaKind === "audio"
                ? `MP3, WAV ou M4A, ${AVATAR_MAX_SECONDS} secondes maximum`
                : `MP4 ou MOV, de ${CLONE_MIN_SECONDS} à ${CLONE_MAX_SECONDS} secondes`}
            </span>
            <input
              type="file"
              accept={mediaKind === "audio" ? "audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a" : "video/mp4,video/quicktime"}
              className="hidden"
              onChange={(e) => void pickMedia(e.target.files?.[0] ?? null)}
            />
          </label>

          <div>
            <p className="mb-2 text-sm text-muted-foreground">Qualité</p>
            <div className="grid grid-cols-2 gap-2">
              {variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariantId(v.id)}
                  className={`rounded-2xl border p-3 text-left ${variantId === v.id ? "border-primary bg-secondary/60" : "border-border bg-card/40"}`}
                >
                  <span className="block text-sm font-medium">{v.label}</span>
                  <span className="block text-xs text-muted-foreground">{v.hint}</span>
                  <span className="mt-1 block text-xs">{costPerSecond(v).toFixed(2)} crédit / seconde</span>
                </button>
              ))}
            </div>
          </div>

          {tool === "clone" && (
            <label className="block text-sm">
              <span className="text-muted-foreground">Orientation du personnage</span>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as "image" | "video")}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
              >
                <option value="image">Comme sur l'image</option>
                <option value="video">Comme dans la vidéo</option>
              </select>
            </label>
          )}

          <label className="block text-sm">
            <span className="text-muted-foreground">Description (facultatif)</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder={promptPlaceholder}
              className="mt-1 w-full resize-none rounded-xl border border-border bg-background px-3 py-2"
            />
          </label>

          <div className="fm-card rounded-2xl border border-border bg-card/40 p-4" style={{ animationDelay: "120ms" }}>
            <p className="text-sm text-muted-foreground">Coût estimé</p>
            <p className="mt-1 text-2xl font-semibold">{estimate !== null ? `${estimate.toFixed(1)} crédits` : "—"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Le coût exact est réglé à la fin. Remboursement automatique en cas d'échec.</p>
          </div>

          <button
            type="button"
            disabled={!image || !media || busy}
            onClick={() => void submit()}
            className="fm-press flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-4 text-[16px] font-semibold text-background disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {phase === "uploading"
              ? `Envoi des fichiers… ${progress}%`
              : phase === "starting"
                ? "Démarrage…"
                : phase === "processing"
                  ? `Génération en cours… ${progress > 0 ? `${progress}%` : ""}`
                  : "Générer"}
          </button>

          {phase === "processing" && (
            <div className="space-y-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="fm-shimmer h-full rounded-full bg-foreground transition-[width] duration-700 ease-out"
                  style={{ width: `${Math.max(progress, 4)}%` }}
                />
              </div>
              <button
                type="button"
                onClick={() => currentJobId && void cancelJob(currentJobId)}
                className="mx-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <XCircle className="h-3.5 w-3.5" /> Annuler la génération
              </button>
            </div>
          )}
          {phase === "processing" && (
            <p className="text-center text-xs text-muted-foreground">
              Cela peut prendre quelques minutes. Vous pouvez quitter cette page : la génération reste dans la liste ci-dessous.
            </p>
          )}
        </div>

        {resultUrl && (
          <div className="fm-card mt-6 space-y-3 rounded-2xl border border-border bg-card/40 p-4">
            <video src={resultUrl} controls playsInline className="fm-zoom mx-auto max-h-[75vh] w-full rounded-3xl bg-black object-contain shadow-2xl" />
            <a
              href={resultUrl}
              target="_blank"
              rel="noreferrer"
              download
              className="flex items-center justify-center gap-2 rounded-full bg-secondary py-3 text-sm font-medium"
            >
              <Download className="h-4 w-4" /> Télécharger
            </a>
            <p className="text-center text-xs text-muted-foreground">Disponible pendant 14 jours : pensez à la télécharger.</p>
          </div>
        )}

        {jobs.length > 0 && (
          <section className="mt-8">
            <h2 className="fm-rise text-lg font-semibold">Mes générations</h2>
            <ul className="mt-3 space-y-2">
              {jobs.map((j, idx) => (
                <li key={j.id} className="fm-card flex items-center gap-3 rounded-2xl border border-border bg-card/40 p-3" style={{ animationDelay: `${idx * 80}ms` }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{STATUS_LABEL[j.status] ?? j.status}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(j.createdAt).toLocaleString("fr-FR")} · {j.seconds.toFixed(0)} s · {j.cost.toFixed(1)} crédits
                    </p>
                  </div>
                  {j.status === "success" && j.resultUrl ? (
                    <a href={j.resultUrl} target="_blank" rel="noreferrer" className="rounded-full bg-secondary px-3 py-1.5 text-xs">
                      Ouvrir
                    </a>
                  ) : j.status === "processing" || j.status === "pending" ? (
                    <button type="button" onClick={() => void refreshOne(j.id)} className="rounded-full bg-secondary px-3 py-1.5 text-xs">
                      Actualiser
                    </button>
                  ) : null}
                  {j.status === "pending" || j.status === "processing" ? (
                    <button type="button" onClick={() => void cancelJob(j.id)} className="rounded-full bg-secondary px-3 py-1.5 text-xs">
                      Annuler
                    </button>
                  ) : (
                    <button type="button" aria-label="Supprimer" onClick={() => void removeJob(j.id)} className="rounded-full p-2 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
