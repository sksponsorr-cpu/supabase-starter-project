import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createMotionVideo, getMotionVideo } from "@/lib/flash-motion.functions";
import { ModelPicker } from "@/components/flash-motion/ModelPicker";
import { DEFAULT_CODE_MODEL, FLASH_MOTION } from "@/lib/flash-motion/config";

export const Route = createFileRoute("/flash-motion")({
  component: FlashMotionPage,
});

type Status = "queued" | "rendering" | "ready" | "failed";

const LABELS: Record<Status, string> = {
  queued: "En file d'attente…",
  rendering: "Fabrication de la vidéo…",
  ready: "Votre vidéo est prête",
  failed: "La vidéo n'a pas pu être créée",
};

function FlashMotionPage() {
  const create = useServerFn(createMotionVideo);
  const check = useServerFn(getMotionVideo);

  const [idea, setIdea] = useState("");
  const [seconds, setSeconds] = useState(10);
  const [withVoiceover, setWithVoiceover] = useState(false);
  const [model, setModel] = useState(DEFAULT_CODE_MODEL);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Vérifie l'avancement toutes les 5 secondes tant que la vidéo n'est pas prête.
  useEffect(() => {
    if (!jobId || status === "ready" || status === "failed") return;
    const timer = setInterval(async () => {
      const res = await check({ data: { jobId } });
      if (!res.ok) return;
      setStatus(res.status as Status);
      if (res.status === "ready") setVideoUrl(res.videoUrl);
      if (res.status === "failed") setMessage(res.error ?? "Erreur pendant la fabrication.");
    }, 5000);
    return () => clearInterval(timer);
  }, [jobId, status, check]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setVideoUrl(null);
    setBusy(true);
    const res = await create({
      data: { idea, seconds, withVoiceover, codeModelId: model },
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(res.message);
      return;
    }
    setJobId(res.jobId);
    setStatus("queued");
  }

  const field = { display: "flex", flexDirection: "column" as const, gap: 6, fontSize: 14 };
  const input = { padding: "10px 12px", borderRadius: 10, border: "1px solid #d4d4d8", fontSize: 15 };

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 18 }}>
      <h1 style={{ fontSize: 26, fontWeight: 700 }}>Flash Motion AI</h1>
      <p style={{ color: "#52525b", fontSize: 15 }}>
        Décrivez votre vidéo, l'IA la fabrique pour vous.
      </p>

      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label style={field}>
          <span>Votre idée</span>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={4}
            placeholder="Ex. : une pub animée pour ma boutique de café à Lomé"
            style={input}
            required
          />
        </label>

        <label style={field}>
          <span>Durée : {seconds} secondes</span>
          <input
            type="range"
            min={FLASH_MOTION.minDurationSeconds}
            max={FLASH_MOTION.maxDurationSeconds}
            value={seconds}
            onChange={(e) => setSeconds(Number(e.target.value))}
          />
        </label>

        <ModelPicker value={model} onChange={setModel} />

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15 }}>
          <input
            type="checkbox"
            checked={withVoiceover}
            onChange={(e) => setWithVoiceover(e.target.checked)}
          />
          Ajouter une voix off
        </label>

        <button
          type="submit"
          disabled={busy || idea.trim().length < 5}
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "none",
            background: "#111827",
            color: "#fff",
            fontSize: 16,
            fontWeight: 600,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "Création en cours…" : "Créer ma vidéo"}
        </button>
      </form>

      {message && <p style={{ color: "#b91c1c", fontSize: 15 }}>{message}</p>}

      {status && (
        <section style={{ border: "1px solid #e4e4e7", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <strong>{LABELS[status]}</strong>
          {status === "ready" && videoUrl && (
            <>
              <video src={videoUrl} controls playsInline style={{ width: "100%", borderRadius: 12 }} />
              <a href={videoUrl} download="flash-motion.mp4" style={{ color: "#111827", fontWeight: 600 }}>
                Télécharger la vidéo
              </a>
            </>
          )}
        </section>
      )}
    </main>
  );
}
