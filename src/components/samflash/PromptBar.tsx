import { useRef, useState } from "react";
import { Plus, Image as ImageIcon, Video, Smile, ArrowUp, Loader2, Sparkles, Mic } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateMedia, checkGenerationStatus, cancelGeneration } from "@/lib/generation.functions";
import { getGenerationAccess } from "@/lib/device.functions";
import { enhancePrompt } from "@/lib/prompt.functions";
import { useI18n } from "@/lib/i18n";
import { playChime } from "@/lib/chime";
import { toast } from "@/lib/toast";

const chip = (active: boolean) =>
  `shrink-0 rounded-full px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm font-medium transition-colors ${
    active ? "bg-foreground text-background" : "text-muted-foreground"
  }`;

/** Message clair selon la limite atteinte. */
function quotaMessage(
  code:
    | "image_daily"
    | "video_daily"
    | "video_pause"
    | "video_seconds"
    | "device_free_used"
    | "subscription_required"
    | "subscription_expired",
  retryAt: string | null,
  remainingSeconds?: number,
) {
  if (code === "video_pause") {
    if (!retryAt) return "Vos générations sont en pause. Réessayez plus tard.";
    const diff = new Date(retryAt).getTime() - Date.now();
    const min = Math.max(1, Math.ceil(diff / 60000));
    return `Pause de refroidissement. Réessayez dans ${min} min.`;
  }
  if (code === "video_seconds") {
    if (remainingSeconds === 0) return "Votre forfait de minutes vidéo est épuisé pour ce mois.";
    return `Pas assez de secondes restantes (${remainingSeconds} s). Souscrivez à une offre supérieure.`;
  }
  if (code === "subscription_required" || code === "device_free_used") {
    return "Quota gratuit épuisé. Abonnez-vous pour continuer !";
  }
  if (code === "subscription_expired") {
    return "Votre abonnement a expiré. Renouvelez-le pour continuer !";
  }
  return "Votre quota est épuisé pour aujourd'hui.";
}

type Props = {
  onStart?: (info: { prompt: string; mediaType: "image" | "video" }) => void;
  onCancelReady?: (cancelFn: () => void) => void;
  onSettled?: () => void;
  onGenerated?: () => void;
  onQuotaExceeded?: () => void;
};

export function PromptBar({ onStart, onCancelReady, onSettled, onGenerated, onQuotaExceeded }: Props) {
  const { t, lang } = useI18n();
  const [res, setRes] = useState("720p");
  const [dur, setDur] = useState("6s");
  const [ratio, setRatio] = useState("2:3");
  const [mode, setMode] = useState<"image" | "video">("video");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [promptFocused, setPromptFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.success(`Image ajoutée : ${file.name}`);
    }
  };

  const handleMicClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isListening) return;
    setIsListening(true);
    // Simulation simple de reconnaissance vocale
    setTimeout(() => setIsListening(false), 3000);
  };

  const focusInput = () => inputRef.current?.focus();
  const blurInput = () => {
    inputRef.current?.blur();
    setPromptFocused(false);
  };

  const generate = useServerFn(generateMedia);
  const checkStatus = useServerFn(checkGenerationStatus);
  const cancelGen = useServerFn(cancelGeneration);
  const enhance = useServerFn(enhancePrompt);
  const checkAccess = useServerFn(getGenerationAccess);

  const runEnhance = async () => {
    const prompt = text.trim();
    if (!prompt || enhancing) return;
    setEnhancing(true);
    playChime("send");
    try {
      const result = await enhance({ data: { prompt, mediaType: mode, language: lang } });
      if (result.ok && result.prompt) {
        setText(result.prompt);
        playChime("success");
      } else {
        toast.error(result.message || "Erreur d'optimisation");
        playChime("error");
      }
    } catch (err) {
      console.error(err);
      toast.error("Échec de l'optimisation");
      playChime("error");
    } finally {
      setEnhancing(false);
    }
  };


  const submit = async () => {
    const prompt = text.trim();
    if (!prompt || busy) return;

    // Contrôle d'accès avant tout appel au moteur : évite un appel inutile.
    try {
      const access = await checkAccess({
        data: {
          mediaType: mode,
          seconds: mode === "video" ? Number(dur.replace(/\D/g, "")) || 0 : 0,
        },
      });
      if (!access.allowed) {
        playChime("error");
        const message =
          access.message ??
          quotaMessage(access.code as "subscription_required", null, access.remainingSeconds);
        setSent(message);
        toast.error(message);
        onQuotaExceeded?.();
        setTimeout(() => setSent(null), 4000);
        return;
      }
    } catch {
      /* en cas d'indisponibilité du contrôle, on laisse le serveur trancher */
    }

    setBusy(true);
    setText("");
    blurInput();
    playChime("send");
    onStart?.({ prompt, mediaType: mode });

    setSent(
      mode === "video"
        ? `${t("video")} ${res} · ${dur} · ${ratio}…`
        : `${t("image")} ${res} · ${ratio}…`,
    );

    let isDone = false;
    try {
      const result = await generate({
        data: { prompt, mediaType: mode, resolution: res, duration: dur, aspectRatio: ratio },
      });

      if (result.ok) {
        if (result.status === "ready") {
          playChime("success");
          setSent(t("genDone"));
          onGenerated?.();
        } else if (result.status === "pending" && result.id) {
          onCancelReady?.(() => {
            isDone = true;
            void cancelGen({ data: { id: result.id! } });
            setBusy(false);
            onSettled?.();
            setSent(null);
          });

          // Polling
          let attempts = 0;
          const maxAttempts = 30; // 90 secondes max

          while (attempts < maxAttempts && !isDone) {
            await new Promise((resolve) => setTimeout(resolve, 3000));
            if (isDone) break;

            attempts++;
            const statusResult = await checkStatus({ data: { id: result.id } }).catch(() => null);

            if (!statusResult || !statusResult.ok) continue; // Ignore network errors during polling

            if (statusResult.status === "ready") {
              isDone = true;
              playChime("success");
              setSent(t("genDone"));
              onGenerated?.();
            } else if (statusResult.status === "error") {
              isDone = true;
              playChime("error");
              setText(prompt);
              setSent(statusResult.error ?? t("genFail"));
            }
          }

          if (!isDone) {
            playChime("error");
            setText(prompt);
            setSent("La génération prend plus de temps que prévu, réessayez plus tard.");
          }
        }
      } else if (result.reason === "quota") {
        playChime("error");
        setText(prompt);
        const message = quotaMessage(result.code, result.retryAt, result.remainingSeconds);
        setSent(message);
        toast.error(message);
        onQuotaExceeded?.();
      } else {
        playChime("error");
        setText(prompt);
        setSent(result.message ?? t("genFail"));
      }
    } catch (error) {
      if (!isDone) {
        playChime("error");
        setText(prompt);
        setSent(error instanceof Error ? error.message : t("genFail"));
      }
    } finally {
      if (!isDone) {
        setBusy(false);
        onSettled?.();
        setTimeout(() => setSent(null), 2600);
      }
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto mb-10 mt-6 px-4">
      {sent && (
        <div className="mx-auto mb-4 w-fit rounded-full bg-card px-4 py-2 text-sm animate-fade-in">
          {sent}
        </div>
      )}


      <div
        className={`relative overflow-hidden rounded-[28px] border bg-card/60 p-3 backdrop-blur-2xl transition-[border-color,box-shadow,background-color] duration-300 ease-out ${
          promptFocused
            ? "border-ring/50 bg-card/80 shadow-[0_10px_40px_-18px_color-mix(in_oklch,var(--ring)_55%,transparent)] ring-1 ring-ring/20"
            : "border-border"
        }`}
      >
        {enhancing && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 animate-[promptShimmer_1.2s_linear_infinite] bg-[linear-gradient(110deg,transparent_25%,color-mix(in_oklch,var(--primary)_28%,transparent)_45%,transparent_65%)] bg-[length:250%_100%]"
          />
        )}

        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setPromptFocused(true)}
          onBlur={() => setPromptFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            }
          }}
          disabled={enhancing}
          placeholder={
            t("promptPlaceholder")
          }
          className={`block w-full resize-none overflow-y-auto bg-transparent px-2 pb-3 text-[16px] sm:text-[17px] leading-6 outline-none transition-[min-height] duration-300 ease-out [field-sizing:content] placeholder:text-muted-foreground ${
            promptFocused || text ? "min-h-24 max-h-56" : "min-h-11 max-h-56"
          }`}
        />

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={handleFileChange} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Ajouter"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary transition-colors hover:bg-secondary/80"
          >
            <Plus className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1 rounded-full bg-secondary p-1 shrink-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              aria-label="Image"
              onClick={() => {
                setMode("image");
                focusInput();
              }}
              className={`flex items-center gap-2 rounded-full px-2 sm:px-3 py-2 ${
                mode === "image" ? "bg-foreground text-background" : "text-muted-foreground"
              }`}
            >
              <ImageIcon className="h-5 w-5 shrink-0" />
              {mode === "image" && <span className="text-xs sm:text-sm font-medium">{t("image")}</span>}
            </button>
            <button
              type="button"
              aria-label="Vidéo"
              onClick={() => {
                setMode("video");
                setRes((r) => (r === "1080p" ? "720p" : r));
                focusInput();
              }}
              className={`flex items-center gap-2 rounded-full px-2 sm:px-3 py-2 ${
                mode === "video" ? "bg-foreground text-background" : "text-muted-foreground"
              }`}
            >
              <Video className="h-5 w-5 shrink-0" />
              {mode === "video" && <span className="text-xs sm:text-sm font-medium">{t("video")}</span>}
            </button>
            <button
              type="button"
              aria-label="Micro"
              onClick={handleMicClick}
              className={`rounded-full px-2 sm:px-3 py-2 shrink-0 transition-colors ${
                isListening ? "text-red-500 animate-pulse" : "text-muted-foreground hover:bg-secondary/50"
              }`}
            >
              <Mic className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Emoji"
              onClick={(e) => {
                e.preventDefault();
                setText((prev) => prev + " ✨");
              }}
              className="rounded-full px-2 sm:px-3 py-2 text-muted-foreground shrink-0 hidden sm:block"
            >
              <Smile className="h-5 w-5" />
            </button>
            </div>
            <button
              type="button"
              aria-label={t("enhance")}
              title={t("enhance")}
              onClick={(e) => {
                e.preventDefault();
                void runEnhance();
              }}
              className="group relative ml-auto flex h-11 items-center gap-2 rounded-full bg-secondary px-3 text-foreground transition-colors disabled:opacity-40 shrink-0"
              disabled={!text.trim() || enhancing || busy}
            >
            {enhancing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
            <span className="hidden text-sm font-medium sm:inline">{t("enhance")}</span>
          </button>
          <button
            type="button"
            aria-label={t("send")}
            onClick={() => void submit()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            disabled={!text.trim() || busy || enhancing}
          >

            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
          </button>
        </div>
      </div>
      <div className="mt-3 flex justify-start sm:justify-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-1">
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-secondary/80 p-1 backdrop-blur-xl">
          {(mode === "video" ? ["480p", "720p"] : ["480p", "720p", "1080p"]).map((r) => (
            <button key={r} type="button" onClick={() => setRes(r)} className={chip(res === r)}>
              {r}
            </button>
          ))}
        </div>
        {mode === "video" && (
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-secondary/80 p-1 backdrop-blur-xl">
            {["3s", "6s"].map((d) => (
              <button key={d} type="button" onClick={() => setDur(d)} className={chip(dur === d)}>
                {d}
              </button>
            ))}
          </div>
        )}
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-secondary/80 p-1 backdrop-blur-xl">
          {["9:16", "2:3", "3:4", "1:1", "16:9"].map((r) => (
            <button key={r} type="button" onClick={() => setRatio(r)} className={chip(ratio === r)}>
              {r}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
