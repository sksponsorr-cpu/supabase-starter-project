import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageCircle, Mic, Square, PenLine, Check, ChevronLeft, Clock } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { listSupportMessages, type SupportMessage } from "@/lib/support.functions";
import { createSupportMessage } from "@/lib/support.functions";
import { uploadSupportVoice } from "@/lib/support-voice.functions";

export const Route = createFileRoute("/signaler")({
  head: () => ({ meta: [{ title: "Signaler un problème — Sam flash 2.0" }] }),
  component: SignalerPage,
});

const SUPPORT_WHATSAPP_NUMBER = "243808782440";
const WHATSAPP_TEXT = "Bonjour, j'ai un problème sur Sam Flash. Pouvez-vous m'aider ?";

const KEYFRAMES = `
@keyframes sfFadeUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
@keyframes sfPop { 0% { transform: scale(.4); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
@keyframes sfBar { 0%,100% { transform: scaleY(.4) } 50% { transform: scaleY(1) } }
`;

type Step = "choose" | "write" | "voice" | "done";

function SignalerPage() {
  const [step, setStep] = useState<Step>("choose");
  const [subject, setSubject] = useState("Problème de génération");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = useServerFn(createSupportMessage);
  const sendVoice = useServerFn(uploadSupportVoice);
  const fetchTickets = useServerFn(listSupportMessages);
  const [tickets, setTickets] = useState<SupportMessage[]>([]);
  const loadTickets = async () => {
    try {
      setTickets(await fetchTickets());
    } catch {
      setTickets([]);
    }
  };
  useEffect(() => { void loadTickets(); }, []);

  const STATUS_LABEL: Record<string, string> = {
    ouvert: "Envoyé",
    lu: "Lu par le support",
    repondu: "Répondu",
    resolu: "Résolu",
  };

  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      setRecorder(rec);
      setRecording(true);
    } catch {
      setError("Accès au micro refusé. Autorise-le dans ton navigateur, ou écris ton message.");
    }
  };

  const stopRecording = () => {
    recorder?.stop();
    setRecording(false);
  };

  const sendText = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await send({ data: { subject, body: body.trim() || "Problème sans détail." } });
      if (res.ok) setStep("done");
      else setError(res.message);
    } catch {
      setError("Envoi impossible. Réessaie ou contacte-nous sur WhatsApp.");
    } finally {
      setBusy(false);
    }
  };

  const sendVoiceMessage = async () => {
    if (!audioBlob) return;
    setBusy(true);
    setError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
        r.onerror = () => reject(new Error("lecture"));
        r.readAsDataURL(audioBlob);
      });
      const up = await sendVoice({ data: { audioBase64: base64, mimeType: audioBlob.type || "audio/webm" } });
      if (!up.ok) return setError(up.message);
      const res = await send({ data: { subject: "Message vocal — problème", body: `Message vocal joint : ${up.path}` } });
      if (res.ok) setStep("done");
      else setError(res.message);
    } catch {
      setError("Envoi du vocal impossible. Réessaie ou écris ton message.");
    } finally {
      setBusy(false);
    }
  };

  const whatsappHref = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_TEXT)}`;
  const progress = step === "choose" ? 1 : step === "done" ? 3 : 2;

  return (
    <main className="mx-auto min-h-screen max-w-md bg-[#07070f] px-5 pb-12 pt-6 text-white">
      <style>{KEYFRAMES}</style>

      <div className="mb-6 flex items-center justify-between">
        {step === "choose" || step === "done" ? (
          <Link to="/app" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10" aria-label="Retour">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        ) : (
          <button type="button" onClick={() => setStep("choose")} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10" aria-label="Retour">
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <span className="text-sm text-white/50">Signaler un problème</span>
        <span className="w-10" />
      </div>

      <div className="mb-8 flex justify-center gap-2" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i <= progress ? "w-8 bg-[#25D366]" : "w-1.5 bg-white/20"}`} />
        ))}
      </div>

      {step === "choose" && (
        <section className="space-y-3" style={{ animation: "sfFadeUp .45s ease-out both" }}>
          <h1 className="text-3xl font-bold tracking-tight">Un souci ?</h1>
          <p className="text-sm text-white/60">Choisis comment nous écrire. Nous te répondons rapidement.</p>
          {tickets.length > 0 && (
            <div className="space-y-2 pt-6">
              <p className="text-xs uppercase tracking-widest text-white/40">Mes messages</p>
              {tickets.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-2xl bg-[#141426] p-4">
                  <Clock className="h-5 w-5 shrink-0 text-white/40" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.subject}</p>
                    <p className="text-xs text-white/40">{new Date(t.created_at).toLocaleString("fr-FR")}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs ${t.status === "repondu" || t.status === "resolu" ? "bg-[#25D366]/20 text-[#25D366]" : "bg-white/10 text-white/60"}`}>
                    {STATUS_LABEL[t.status] ?? t.status}
                  </span>
                </div>
              ))}
            </div>
          )}
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center gap-4 rounded-3xl bg-[#25D366] p-5 text-black transition-transform active:scale-[0.98]">
            <MessageCircle className="h-7 w-7" />
            <span className="text-base font-semibold">Contacter sur WhatsApp</span>
          </a>
          <button type="button" onClick={() => setStep("write")} className="flex w-full items-center gap-4 rounded-3xl border border-white/10 bg-[#141426] p-5 text-left transition-transform active:scale-[0.98]">
            <PenLine className="h-7 w-7 text-violet-300" />
            <span className="text-base font-semibold">Écrire un message</span>
          </button>
          <button type="button" onClick={() => setStep("voice")} className="flex w-full items-center gap-4 rounded-3xl border border-white/10 bg-[#141426] p-5 text-left transition-transform active:scale-[0.98]">
            <Mic className="h-7 w-7 text-violet-300" />
            <span className="text-base font-semibold">Envoyer un message vocal</span>
          </button>
        </section>
      )}

      {step === "write" && (
        <section className="space-y-4" style={{ animation: "sfFadeUp .45s ease-out both" }}>
          <h1 className="text-3xl font-bold tracking-tight">Décris le problème</h1>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={140} placeholder="Sujet" className="w-full rounded-2xl border border-white/10 bg-[#141426] px-4 py-3 text-sm outline-none focus:border-violet-500" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={7} placeholder="Ce qui s'est passé, ce que tu essayais de faire…" className="w-full rounded-2xl border border-white/10 bg-[#141426] px-4 py-3 text-sm outline-none focus:border-violet-500" />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="button" disabled={busy} onClick={() => void sendText()} className="w-full rounded-full bg-violet-600 py-4 font-semibold disabled:opacity-50">
            {busy ? "Envoi…" : "Envoyer au support"}
          </button>
        </section>
      )}

      {step === "voice" && (
        <section className="space-y-6 text-center" style={{ animation: "sfFadeUp .45s ease-out both" }}>
          <h1 className="text-3xl font-bold tracking-tight">Message vocal</h1>
          <p className="text-sm text-white/60">Appuie, décris le problème, puis arrête.</p>
          <div className="flex h-10 items-end justify-center gap-1" aria-hidden>
            {recording && [0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="w-1 rounded-full bg-red-400" style={{ height: "100%", animation: `sfBar .8s ease-in-out ${i * 0.12}s infinite` }} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => (recording ? stopRecording() : void startRecording())}
            aria-label={recording ? "Arrêter l'enregistrement" : "Commencer l'enregistrement"}
            className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full transition-all active:scale-95 ${recording ? "bg-red-500" : "bg-violet-600"}`}
          >
            {recording ? <Square className="h-8 w-8" /> : <Mic className="h-10 w-10" />}
          </button>
          {audioUrl && !recording && <audio controls src={audioUrl} className="w-full" />}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="button" disabled={!audioBlob || busy || recording} onClick={() => void sendVoiceMessage()} className="w-full rounded-full bg-violet-600 py-4 font-semibold disabled:opacity-40">
            {busy ? "Envoi…" : "Envoyer le vocal"}
          </button>
        </section>
      )}

      {step === "done" && (
        <section className="flex flex-col items-center gap-4 pt-10 text-center" style={{ animation: "sfFadeUp .45s ease-out both" }}>
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#25D366] text-black" style={{ animation: "sfPop .5s cubic-bezier(.2,.8,.2,1) both" }}>
            <Check className="h-10 w-10" />
          </span>
          <h1 className="text-3xl font-bold tracking-tight">Message envoyé</h1>
          <p className="text-sm text-white/60">Le support te répondra dès que possible. Tes crédits ne sont pas décomptés.</p>
          <Link to="/app" className="mt-4 rounded-full bg-white/10 px-6 py-3 text-sm">Retour à l'accueil</Link>
        </section>
      )}
    </main>
  );
}
