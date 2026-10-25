import { useEffect, useRef, useState } from "react";
import { MessageCircle, Mic, Square, PenLine, Check, X, ChevronLeft } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createSupportMessage } from "@/lib/support.functions";
import { uploadSupportVoice } from "@/lib/support-voice.functions";

/** Numéro du support WhatsApp (format international, sans +). */
export const SUPPORT_WHATSAPP_NUMBER = "243808782440";
const WHATSAPP_TEXT = "Bonjour, la génération Sam Flash ne fonctionne pas. Pouvez-vous m'aider ?";

type Step = "choose" | "write" | "voice" | "done";

/**
 * Bouton rond animé + fenêtre « Signaler un problème » en étapes.
 * Affiché seulement quand le message d'erreur de génération est affiché.
 */
export function SupportWhatsAppButton({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const [open, setOpen] = useState(false);
  if (!visible) return null;
  return (
    <>
      <div className="fixed bottom-24 right-4 z-[120] flex items-center gap-2">
        <div className="max-w-[190px] rounded-2xl rounded-br-sm bg-[#141426] px-3 py-2 text-xs text-white shadow-lg">
          T'as un souci ? Contacte-nous ici.
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Contacter le support"
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-black shadow-lg transition-transform active:scale-95"
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366]/60" aria-hidden />
          <MessageCircle className="relative h-6 w-6" />
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fermer"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {open && <ReportProblemSheet onClose={() => setOpen(false)} />}
    </>
  );
}

/** Fenêtre en étapes : choisir → écrire ou parler → envoyé. */
export function ReportProblemSheet({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("choose");
  const [subject, setSubject] = useState("Problème de génération");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = useServerFn(createSupportMessage);
  const sendVoice = useServerFn(uploadSupportVoice);

  // Enregistrement vocal
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      setError("Accès au micro refusé. Autorise-le dans ton navigateur, ou écris ton message.");
    }
  };
  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const sendText = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await send({ data: { subject, body: body.trim() || "Problème de génération (sans détail)." } });
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
        r.onerror = () => reject(new Error("read"));
        r.readAsDataURL(audioBlob);
      });
      const up = await sendVoice({ data: { audioBase64: base64, mimeType: audioBlob.type || "audio/webm" } });
      if (!up.ok) return setError(up.message);
      const res = await send({ data: { subject: "Message vocal — problème de génération", body: `Message vocal joint : ${up.path}` } });
      if (res.ok) setStep("done");
      else setError(res.message);
    } catch {
      setError("Envoi du vocal impossible. Réessaie ou écris ton message.");
    } finally {
      setBusy(false);
    }
  };

  const whatsappHref = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_TEXT)}`;
  const stepIndex = step === "choose" ? 0 : step === "done" ? 2 : 1;

  return (
    <>
    <style>{KEYFRAMES}</style>
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_.25s_ease-out]" role="dialog" aria-label="Signaler un problème">
      <div className="w-full max-w-md translate-y-0 rounded-t-[28px] border-t border-white/10 bg-[#0d0d18] p-6 pb-10 text-white shadow-2xl transition-transform duration-300 animate-[slideUp_.35s_cubic-bezier(.2,.8,.2,1)]">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20" />
        <div className="mb-5 flex items-center justify-between">
          {step !== "choose" && step !== "done" ? (
            <button type="button" onClick={() => setStep("choose")} className="flex items-center gap-1 text-sm text-white/60">
              <ChevronLeft className="h-4 w-4" /> Retour
            </button>
          ) : <span />}
          <button type="button" onClick={onClose} className="text-sm text-white/60">Fermer</button>
        </div>

        {/* Progression */}
        <div className="mb-6 flex justify-center gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === stepIndex ? "w-8 bg-[#25D366]" : "w-1.5 bg-white/20"}`} />
          ))}
        </div>

        {step === "choose" && (
          <div className="space-y-3 animate-[fadeUp_.4s_ease-out]">
            <h2 className="text-2xl font-semibold">Signaler un problème</h2>
            <p className="text-sm text-white/60">Choisis comment nous écrire. Nous répondons rapidement.</p>
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 rounded-2xl bg-[#25D366] p-4 text-black transition-transform active:scale-[0.98]">
              <MessageCircle className="h-6 w-6" />
              <span className="font-semibold">Contacter sur WhatsApp</span>
            </a>
            <button type="button" onClick={() => setStep("write")} className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-[#141426] p-4 text-left transition-transform active:scale-[0.98]">
              <PenLine className="h-6 w-6 text-violet-300" />
              <span className="font-semibold">Écrire un message</span>
            </button>
            <button type="button" onClick={() => setStep("voice")} className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-[#141426] p-4 text-left transition-transform active:scale-[0.98]">
              <Mic className="h-6 w-6 text-violet-300" />
              <span className="font-semibold">Envoyer un message vocal</span>
            </button>
          </div>
        )}

        {step === "write" && (
          <div className="space-y-4 animate-[fadeUp_.4s_ease-out]">
            <h2 className="text-2xl font-semibold">Décris le problème</h2>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={140} className="w-full rounded-xl border border-white/10 bg-[#141426] px-4 py-3 text-sm outline-none focus:border-violet-500" placeholder="Sujet" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={5} className="w-full rounded-xl border border-white/10 bg-[#141426] px-4 py-3 text-sm outline-none focus:border-violet-500" placeholder="Ce qui s'est passé, ce que tu essayais de faire…" />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button type="button" disabled={busy} onClick={() => void sendText()} className="w-full rounded-full bg-violet-600 py-3 font-semibold disabled:opacity-50">
              {busy ? "Envoi…" : "Envoyer au support"}
            </button>
          </div>
        )}

        {step === "voice" && (
          <div className="space-y-5 text-center animate-[fadeUp_.4s_ease-out]">
            <h2 className="text-2xl font-semibold">Message vocal</h2>
            <p className="text-sm text-white/60">Appuie, décris le problème, puis arrête.</p>
            <button
              type="button"
              onClick={() => (recording ? stopRecording() : void startRecording())}
              className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full transition-all ${recording ? "bg-red-500 animate-pulse" : "bg-violet-600"}`}
              aria-label={recording ? "Arrêter l'enregistrement" : "Commencer l'enregistrement"}
            >
              {recording ? <Square className="h-7 w-7" /> : <Mic className="h-8 w-8" />}
            </button>
            {audioUrl && !recording && <audio controls src={audioUrl} className="mx-auto w-full" />}
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button type="button" disabled={!audioBlob || busy || recording} onClick={() => void sendVoiceMessage()} className="w-full rounded-full bg-violet-600 py-3 font-semibold disabled:opacity-40">
              {busy ? "Envoi…" : "Envoyer le vocal"}
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-4 py-6 text-center animate-[fadeUp_.4s_ease-out]">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#25D366] text-black animate-[pop_.5s_cubic-bezier(.2,.8,.2,1)]">
              <Check className="h-8 w-8" />
            </span>
            <h2 className="text-2xl font-semibold">Message envoyé</h2>
            <p className="text-sm text-white/60">Le support te répondra dès que possible. Tes crédits ne sont pas décomptés.</p>
            <button type="button" onClick={onClose} className="mt-2 rounded-full bg-white/10 px-6 py-2.5 text-sm">Fermer</button>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
