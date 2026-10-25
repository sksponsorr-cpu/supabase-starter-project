import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { checkVoiceOff, startVoiceOff, voiceCostFor } from "@/lib/voice-off.functions";
import { DEFAULT_KIE_VOICE, KIE_VOICES } from "@/lib/kie-voices";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/voix-off")({
  head: () => ({ meta: [{ title: "Voix off — Sam flash 2.0" }] }),
  component: VoixOffPage,
});

const MAX = 1500;

function VoixOffPage() {
  const start = useServerFn(startVoiceOff);
  const check = useServerFn(checkVoiceOff);
  const [text, setText] = useState("");
  const [voice, setVoice] = useState(DEFAULT_KIE_VOICE);
  const [busy, setBusy] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  /** Aperçu officiel de la voix, fourni par KIE. */
  const playPreview = (id: string) => {
    // Un clic sur la voix en cours de lecture l'arrête.
    if (playingId === id) {
      previewRef.current?.pause();
      setPlayingId(null);
      return;
    }
    previewRef.current?.pause();
    const a = new Audio(`https://static.aiquickdraw.com/elevenlabs/voice/${id}.mp3`);
    previewRef.current = a;
    a.onended = () => setPlayingId(null);
    a.onpause = () => setPlayingId((cur) => (cur === id ? null : cur));
    setPlayingId(id);
    void a.play().catch(() => {
      setPlayingId(null);
      toast("Aperçu indisponible pour cette voix.");
    });
  };

  const cost = useMemo(() => (text.trim() ? voiceCostFor(text.trim().length) : 0), [text]);

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  const onCreate = async () => {
    if (!text.trim()) return toast("Écris un texte d'abord.");
    setBusy(true);
    setAudioUrl(null);
    try {
      const r = await start({ data: { text: text.trim(), voice } });
      if (!r.ok) {
        toast(r.message);
        setBusy(false);
        return;
      }
      pollRef.current = window.setInterval(async () => {
        try {
          const s = await check({ data: { taskId: r.taskId } });
          if (s.state === "success" && s.url) {
            if (pollRef.current) window.clearInterval(pollRef.current);
            setAudioUrl(s.url);
            setBusy(false);
          } else if (s.state === "fail") {
            if (pollRef.current) window.clearInterval(pollRef.current);
            toast("La voix n'a pas pu être générée.");
            setBusy(false);
          }
        } catch {
          /* on réessaie au prochain tour */
        }
      }, 3000);
    } catch {
      toast("La voix n'a pas pu démarrer.");
      setBusy(false);
    }
  };

  return (
    <>
      <style>{`@keyframes vbar { 0%,100% { transform: scaleY(.4) } 50% { transform: scaleY(1) } }`}</style>
    <main className="mx-auto min-h-screen max-w-md px-5 pb-16 pt-6">
      <Link to="/app" className="text-sm text-muted-foreground">← Retour au studio</Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">Voix off</h1>
      <p className="mt-1 text-sm text-muted-foreground">Écris ton texte, choisis une voix, télécharge le fichier audio.</p>

      <div className="mt-6 space-y-5">
        <div>
          <label className="text-sm font-medium text-foreground">Ton texte</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX))}
            rows={6}
            placeholder="Écris ton message…"
            className="mt-2 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary/60"
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">{text.length} / {MAX}</p>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">La voix</label>
          <p className="mt-1 text-xs text-muted-foreground">Écoute une voix avant de la choisir.</p>
          <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto">
            {KIE_VOICES.map((v) => (
              <li
                key={v.id}
                className={`flex items-center gap-3 rounded-2xl border p-3 ${
                  voice === v.id ? "border-primary bg-primary/10" : "border-border bg-card"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setVoice(v.id)}
                  className="flex-1 text-left"
                >
                  <span className="block text-sm font-semibold text-foreground">{v.name}</span>
                  <span className="block text-xs text-muted-foreground">{v.style}</span>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[11px] text-muted-foreground">
                    {voiceCostFor(text.trim().length || 1000)} crédit{voiceCostFor(text.trim().length || 1000) > 1 ? "s" : ""}
                  </span>
                  <button
                    type="button"
                    aria-label={playingId === v.id ? `Arrêter ${v.name}` : `Écouter ${v.name}`}
                    onClick={() => playPreview(v.id)}
                    className={`relative flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 ${playingId === v.id ? "ring-4 ring-primary/30" : ""}`}
                  >
                    {playingId === v.id ? (
                      <span className="flex items-end gap-[2px]" aria-hidden>
                        <span className="h-3 w-[3px] animate-[vbar_.8s_ease-in-out_infinite] bg-current" />
                        <span className="h-4 w-[3px] animate-[vbar_.8s_ease-in-out_.15s_infinite] bg-current" />
                        <span className="h-2 w-[3px] animate-[vbar_.8s_ease-in-out_.3s_infinite] bg-current" />
                      </span>
                    ) : (
                      "▶"
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => void onCreate()}
          className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          {busy ? "Création en cours…" : `Créer la voix${cost ? ` (${cost} crédit${cost > 1 ? "s" : ""})` : ""}`}
        </button>

        {audioUrl && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <audio controls src={audioUrl} className="w-full" />
            <a href={audioUrl} download className="block text-center text-sm font-semibold text-primary">Télécharger le fichier audio</a>
          </div>
        )}
      </div>
    </main>
    </>
  );
}
