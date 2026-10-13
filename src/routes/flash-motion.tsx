import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createMotionVideo, listMotionVideos, uploadMotionReference, uploadMotionVoice } from "@/lib/flash-motion.functions";
import { DEFAULT_CODE_MODEL, FLASH_MOTION } from "@/lib/flash-motion/config";

export const Route = createFileRoute("/flash-motion")({
  component: FlashMotionPage,
});

type Row = {
  id: string;
  idea: string;
  seconds: number;
  status: "queued" | "rendering" | "ready" | "failed";
  stage: string | null;
  progress: number;
  error: string | null;
  createdAt: string;
  videoUrl: string | null;
};

const STATUS_LABEL: Record<Row["status"], string> = {
  queued: "En file d'attente",
  rendering: "En cours",
  ready: "Prête",
  failed: "Échec",
};

function FlashMotionPage() {
  const create = useServerFn(createMotionVideo);
  const list = useServerFn(listMotionVideos);
  const upload = useServerFn(uploadMotionReference);
  const uploadVoice = useServerFn(uploadMotionVoice);
  const [format, setFormat] = useState<"vertical" | "square" | "landscape">("vertical");
  const [voice, setVoice] = useState<{ path: string; name: string } | null>(null);
  const [refs, setRefs] = useState<{ path: string; preview: string }[]>([]);

  const [idea, setIdea] = useState("");
  const [seconds, setSeconds] = useState(10);
  const [withVoiceover, setWithVoiceover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const res = await list({});
    if (res.ok) setRows(res.rows as Row[]);
  }, [list]);

  // Historique chargé à l'ouverture de la page : rien ne disparaît après une actualisation.
  useEffect(() => {
    load();
  }, [load]);

  // Rafraîchit toutes les 2 secondes tant qu'une vidéo est en cours.
  const pending = rows.some((r) => r.status === "queued" || r.status === "rendering");
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [pending, load]);

  function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function onPickFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files).slice(0, 3 - refs.length)) {
      const dataUrl = await readAsDataUrl(file);
      const res = await upload({ data: { mime: file.type, dataBase64: dataUrl.split(",")[1] } });
      if (!res.ok) {
        setMessage(res.message);
        continue;
      }
      setRefs((prev) => [...prev, { path: res.path, preview: dataUrl }]);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setBusy(true);
    const res = await create({
      data: { idea, seconds, withVoiceover, format, voicePath: voice?.path, referencePaths: refs.map((r) => r.path), codeModelId: DEFAULT_CODE_MODEL },
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(res.message);
      return;
    }
    setIdea("");
    setRefs([]);
    setVoice(null);
    load();
  }

  const field = { display: "flex", flexDirection: "column" as const, gap: 6, fontSize: 14 };
  const input = { padding: "10px 12px", borderRadius: 10, border: "1px solid #d4d4d8", fontSize: 15 };

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 18 }}>
      <h1 style={{ fontSize: 26, fontWeight: 700 }}>Motion AI</h1>
      <p style={{ color: "#52525b", fontSize: 15 }}>Décrivez votre vidéo, l'IA la fabrique pour vous.</p>

      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label style={field}>
          <span>Votre idée</span>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={4}
            placeholder="Ex. : une pub animée pour ma boutique de café"
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

        <label style={field}>
          <span>Format de la vidéo</span>
          <select value={format} onChange={(e) => setFormat(e.target.value as typeof format)} style={input}>
            <option value="vertical">Vertical 9:16 (TikTok, Reels)</option>
            <option value="square">Carré 1:1 (Instagram, Facebook)</option>
            <option value="landscape">Horizontal 16:9 (YouTube, site web)</option>
          </select>
        </label>

        <div style={field}>
          <span>Envoyer un vocal (facultatif, MP3, M4A ou WAV, 4 Mo max)</span>
          <input
            type="file"
            accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav"
            disabled={!!voice}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const dataUrl = await readAsDataUrl(file);
              const res = await uploadVoice({ data: { mime: file.type, dataBase64: dataUrl.split(",")[1] } });
              if (!res.ok) setMessage(res.message);
              else setVoice({ path: res.path, name: file.name });
            }}
          />
          {voice && (
            <span style={{ fontSize: 13, color: "#52525b" }}>
              Vocal ajouté : {voice.name}{" "}
              <button type="button" onClick={() => setVoice(null)} style={{ marginLeft: 8, border: "none", background: "none", color: "#b91c1c", cursor: "pointer" }}>
                Retirer
              </button>
            </span>
          )}
        </div>

        <div style={field}>
          <span>Images de référence (facultatif, 3 maximum : JPG, PNG, WebP)</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={refs.length >= 3}
            onChange={(e) => onPickFiles(e.target.files)}
          />
          {refs.length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {refs.map((r, i) => (
                <div key={r.path} style={{ position: "relative" }}>
                  <img src={r.preview} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8 }} />
                  <button
                    type="button"
                    onClick={() => setRefs((prev) => prev.filter((_, j) => j !== i))}
                    style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 999, border: "none", background: "#111827", color: "#fff" }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15 }}>
          <input type="checkbox" checked={withVoiceover} disabled={!!voice} onChange={(e) => setWithVoiceover(e.target.checked)} />
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
          {busy ? "Envoi…" : "Créer ma vidéo"}
        </button>
      </form>

      {message && <p style={{ color: "#b91c1c", fontSize: 15 }}>{message}</p>}

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 8 }}>Mes vidéos</h2>

      {rows.length === 0 && <p style={{ color: "#71717a", fontSize: 14 }}>Aucune vidéo pour le moment.</p>}

      {rows.map((r) => (
        <section key={r.id} style={{ border: "1px solid #e4e4e7", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14 }}>
            <strong style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.idea}</strong>
            <span style={{ whiteSpace: "nowrap", color: r.status === "failed" ? "#b91c1c" : "#52525b" }}>
              {STATUS_LABEL[r.status]}
            </span>
          </div>

          {(r.status === "queued" || r.status === "rendering") && (
            <>
              <div style={{ height: 8, borderRadius: 999, background: "#e4e4e7", overflow: "hidden" }}>
                <div style={{ width: `${r.progress}%`, height: "100%", background: "#111827", transition: "width 0.5s" }} />
              </div>
              <span style={{ fontSize: 13, color: "#52525b" }}>
                {r.stage ?? "En attente du worker…"} · {r.progress} %
              </span>
            </>
          )}

          {r.status === "failed" && <span style={{ fontSize: 13, color: "#b91c1c" }}>{r.error ?? "Erreur pendant la fabrication."}</span>}

          {r.status === "ready" && r.videoUrl && (
            <>
              <video src={r.videoUrl} controls playsInline style={{ width: "100%", maxWidth: 260, maxHeight: 420, margin: "0 auto", display: "block", borderRadius: 12, background: "#000" }} />
              <a href={r.videoUrl} download="motion-ai.mp4" style={{ color: "#111827", fontWeight: 600 }}>
                Télécharger la vidéo
              </a>
            </>
          )}
        </section>
      ))}
    </main>
  );
}
