import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Image as ImageIcon, Video, Smile, ArrowUp, Loader2, Sparkles, Mic, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateMedia, checkGenerationStatus, cancelGeneration } from "@/lib/generation.functions";
import { updateProjectTitle } from "@/lib/project.functions";
import { getGenerationAccess } from "@/lib/device.functions";
import { enhancePrompt } from "@/lib/prompt.functions";
import { useI18n } from "@/lib/i18n";
import { playChime } from "@/lib/chime";
import { toast } from "@/lib/toast";
import { useLocation } from "@tanstack/react-router";
import { NoticeBanner } from "@/components/samflash/NoticeBanner";
import { notifyDone, optionOn, speak, usePrefs } from "@/lib/prefs";

const IDEAS = [
  "Un astronaute qui marche sur une plage au coucher du soleil",
  "Un chat samouraï sous la pluie dans une ruelle de Tokyo néon",
  "Une voiture de sport qui traverse un désert, plan drone",
  "Un marché africain coloré à l'heure dorée, ambiance sonore vivante",
];
const MEMORY_KEY = "samflash:composer";

const chip = (active: boolean) =>
  `shrink-0 rounded-full px-2.5 py-1 text-[11px] sm:px-3 sm:py-1.5 sm:text-xs font-medium transition-colors ${
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
  /** Texte à injecter dans la zone de saisie (réutiliser un prompt depuis la galerie). */
  prefill?: { text: string; nonce: number } | null;
};

export function PromptBar({ onStart, onCancelReady, onSettled, onGenerated, onQuotaExceeded, prefill }: Props) {
  const { t, lang } = useI18n();
  const prefs = usePrefs();
  const autoEnhance = optionOn(prefs, "autoEnhance", false);
  const translateOn = optionOn(prefs, "skillTranslate", false);
  const ideasOn = optionOn(prefs, "skillIdeas", false);
  const memoryOn = optionOn(prefs, "memory", true);
  const highQuality = optionOn(prefs, "highQuality", true);
  const voiceMode = optionOn(prefs, "voiceMode", false);
  const debug = optionOn(prefs, "debug", false);
  const beta = optionOn(prefs, "beta", false);
  const tone = prefs.tone ?? "Naturel";
  // Au moins un mode doit rester disponible.
  const allowImage = optionOn(prefs, "skillImage", true) || !optionOn(prefs, "skillVideo", true);
  const allowVideo = optionOn(prefs, "skillVideo", true) || !optionOn(prefs, "skillImage", true);
  const [res, setRes] = useState("720p");
  const [dur, setDur] = useState("5s");
  const [userPlan, setUserPlan] = useState<string>("free");
  const [ratio, setRatio] = useState("2:3");
  const [mode, setMode] = useState<"image" | "video">("video");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [promptFocused, setPromptFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Référence à l'instance SpeechRecognition en cours, pour pouvoir l'arrêter
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 1920;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
          setAttachedImage(dataUrl);
        } else {
          setAttachedImage(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleMicClick = (e: React.MouseEvent) => {
    e.preventDefault();

    // Second clic pendant l'écoute → arrêt immédiat
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    // Vérification du support navigateur (Firefox ne supporte pas SpeechRecognition)
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ??
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setSent("Dictée vocale non disponible sur ce navigateur.");
      setTimeout(() => setSent(null), 4000);
      return;
    }

    const recognition: SpeechRecognition = new SpeechRecognitionAPI();
    // Langue calée sur la langue de l'UI (fr → fr-FR, sinon en-US)
    recognition.lang = lang === "fr" ? "fr-FR" : "en-US";
    recognition.continuous = beta;     // bêta : dictée continue ; sinon une phrase puis stop
    recognition.interimResults = false; // résultat final uniquement
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      // Appende au texte existant (avec espace) ou initialise
      setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      setIsListening(false);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsListening(false);
      recognitionRef.current = null;
      if (event.error === "not-allowed") {
        setSent("Accès au micro refusé. Autorise-le dans les paramètres de ton navigateur.");
      } else if (event.error === "no-speech") {
        setSent("Aucune voix détectée. Réessaie.");
      } else {
        setSent(`Erreur micro : ${event.error}`);
      }
      setTimeout(() => setSent(null), 4000);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
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
  const renameProj = useServerFn(updateProjectTitle);
  const { search } = useLocation();
  const currentProjectId = (search as any)?.project;

  const refreshAccess = useCallback(() => {
    checkAccess({ data: { mediaType: "video", seconds: 0 } })
      .then((res) => {
        if (res?.planType) setUserPlan(res.planType);
      })
      .catch(() => {});
  }, [checkAccess]);

  useEffect(() => {
    refreshAccess();
    const onSubUpdated = () => refreshAccess();
    window.addEventListener("subscription-updated", onSubUpdated);
    return () => window.removeEventListener("subscription-updated", onSubUpdated);
  }, [refreshAccess]);

  // Mémoire : restaure les derniers réglages utilisés.
  const restored = useRef(false);
  const hadSaved = useRef(false);
  useEffect(() => {
    if (restored.current || !memoryOn) return;
    restored.current = true;
    try {
      const m = JSON.parse(window.localStorage.getItem(MEMORY_KEY) ?? "null") as
        | { res?: string; dur?: string; ratio?: string; mode?: "image" | "video" }
        | null;
      if (m) {
        hadSaved.current = true;
        if (m.res) setRes(m.res);
        if (m.dur) setDur(m.dur);
        if (m.ratio) setRatio(m.ratio);
        if (m.mode) setMode(m.mode);
      }
    } catch {
      /* ignoré */
    }
  }, [memoryOn]);
  useEffect(() => {
    if (!memoryOn) return;
    try {
      window.localStorage.setItem(MEMORY_KEY, JSON.stringify({ res, dur, ratio, mode }));
    } catch {
      /* ignoré */
    }
  }, [memoryOn, res, dur, ratio, mode]);

  // Qualité maximale (réglage avancé) : choisit la meilleure résolution à chaque changement de mode.
  const firstQuality = useRef(true);
  useEffect(() => {
    if (firstQuality.current) {
      firstQuality.current = false;
      if (hadSaved.current) return; // les derniers réglages mémorisés restent prioritaires
    }
    setRes(highQuality ? (mode === "video" ? "720p" : "1080p") : "480p");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highQuality]);

  // Un mode désactivé dans « Compétences » ne doit pas rester actif.
  useEffect(() => {
    if (mode === "image" && !allowImage) setMode("video");
    if (mode === "video" && !allowVideo) setMode("image");
  }, [mode, allowImage, allowVideo]);

  // Prompt réutilisé depuis la galerie / la visionneuse.
  useEffect(() => {
    if (!prefill?.text) return;
    setText(prefill.text);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [prefill?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const afterSuccess = (prompt: string) => {
    notifyDone(prefs, "Sam flash", "Votre création est prête ✨");
    if (voiceMode) speak(t("genDone"), lang);
    void prompt;
  };

  const runEnhance = async () => {
    const prompt = text.trim();
    if (!prompt || enhancing) return;
    setEnhancing(true);
    playChime("send");
    try {
      const result = await enhance({ data: { prompt, mediaType: mode, language: lang, tone, translate: translateOn } });
      if (result.ok && result.prompt) {
        setText(result.prompt);
        playChime("success");
      } else {
        toast.error("Optimisation indisponible pour le moment");
        playChime("error");
      }
    } catch (err) {
      console.error(err);
      toast.error("Optimisation indisponible pour le moment");
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

    // Amélioration automatique du prompt (Personnaliser → Amélioration auto).
    let finalPrompt = prompt;
    if (autoEnhance) {
      setEnhancing(true);
      try {
        const r = await enhance({ data: { prompt, mediaType: mode, language: lang, tone, translate: translateOn } });
        if (r.ok && r.prompt) finalPrompt = r.prompt;
      } catch {
        /* on garde le prompt d'origine */
      } finally {
        setEnhancing(false);
      }
    }

    setBusy(true);
    setText("");
    blurInput();
    playChime("send");
    onStart?.({ prompt: finalPrompt, mediaType: mode });
    if (debug) console.debug("[Sam flash debug] génération", { mode, res, dur, ratio, finalPrompt });

    setSent(
      mode === "video"
        ? `${t("video")} ${res} · ${dur} · ${ratio}…`
        : `${t("image")} ${res} · ${ratio}…`,
    );

    let isDone = false;
    try {
      const result = await generate({
        data: { prompt: finalPrompt, mediaType: mode, resolution: res, duration: dur, aspectRatio: ratio, imageUrl: attachedImage, project_id: currentProjectId },
      });

      if (result.ok) {
        if (result.status === "ready") {
          // Succès synchrone
          playChime("success");
          setSent(t("genDone"));
          afterSuccess(finalPrompt);
          onGenerated?.();
          if (currentProjectId) {
            renameProj({ data: { id: currentProjectId, title: prompt.split(" ").slice(0, 5).join(" ") } }).catch(() => {});
          }
          // Succès : efface le bandeau après 4 s
          setTimeout(() => setSent(null), 4000);
        } else if (result.status === "pending" && result.id) {
          // Job asynchrone : on démarre le polling
          onCancelReady?.(() => {
            isDone = true;
            void cancelGen({ data: { id: result.id! } });
            setBusy(false);
            onSettled?.();
            setSent(null);
          });

          // Polling
          let attempts = 0;
          const maxAttempts = 100; // ~5 minutes max (100 × 3 s)

          while (attempts < maxAttempts && !isDone) {
            await new Promise((resolve) => setTimeout(resolve, 3000));
            if (isDone) break;

            attempts++;
            const statusResult = await checkStatus({ data: { id: result.id } }).catch((err) => {
              console.error("[PromptBar] Polling error (attempt", attempts, "):", err);
              return null;
            });

            if (!statusResult || !statusResult.ok) continue; // Erreur réseau transitoire, on continue

            if (statusResult.status === "ready") {
              isDone = true;
              playChime("success");
              setSent(t("genDone"));
              afterSuccess(finalPrompt);
              onGenerated?.();
              if (currentProjectId) {
                renameProj({ data: { id: currentProjectId, title: prompt.split(" ").slice(0, 5).join(" ") } }).catch(() => {});
              }
              // Succès après polling : efface le bandeau après 4 s
              setTimeout(() => setSent(null), 4000);
            } else if (statusResult.status === "error") {
              isDone = true;
              playChime("error");
              setText(prompt);
              // Erreur Fal.ai : message persistant (pas de setTimeout)
              setSent(statusResult.error ?? t("genFail"));
            }
          }

          if (!isDone) {
            playChime("error");
            setText(prompt);
            // Timeout polling : message persistant (pas de setTimeout)
            setSent("La génération a pris trop de temps. Réessayez. Vos secondes ne sont pas décomptées.");
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
        
        // Gérer le message selon le type d'utilisateur
        let errorMessage = result.message ?? "Une erreur est survenue pendant la génération. Réessayez. Vos secondes ne sont pas décomptées.";
        
        if (result.message === "SERVICE_UNAVAILABLE") {
          if (userPlan === "free") {
            errorMessage = "Les services de génération sont temporairement saturés à cause du grand nombre de demandes.\n\nDésolé pour cette gêne occasionnée.\nVeuillez réessayer dans quelques heures (cela peut prendre plus longtemps selon la demande).\n\nMerci de votre patience.";
          } else {
            errorMessage = "Désolé pour cette gêne occasionnée.\nLe service est momentanément indisponible car une mise à jour est en cours.\n\nVos secondes ne sont pas décomptées.\nRéessayez dans 15 à 20 minutes.\n\nMerci de votre patience.";
          }
        }
        
        if (debug && result.message && result.message !== "SERVICE_UNAVAILABLE") {
          errorMessage += `\n\nDétail technique : ${result.message}`;
        }
        setSent(errorMessage);
      }
    } catch (error) {
      if (!isDone) {
        console.error("[PromptBar] Generation error:", error);
        playChime("error");
        setText(prompt);
        // Erreur inattendue : message persistant, pas de setTimeout
        setSent("Une erreur est survenue pendant la génération. Réessayez. Vos secondes ne sont pas décomptées.");
      }
    } finally {
      setBusy(false);
      onSettled?.();
      // ⚠️ Pas de setSent(null) ici : les messages d'erreur doivent rester visibles
      // jusqu'à ce que l'utilisateur relance une génération ou ferme le bandeau (bouton ✕).
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto mb-10 mt-6 px-4">
      {sent && <NoticeBanner message={sent} onClose={() => setSent(null)} />}

      <div
        className={`relative overflow-hidden rounded-[28px] border bg-card/60 p-2 sm:p-3 backdrop-blur-2xl transition-[border-color,box-shadow,background-color] duration-300 ease-out flex flex-col gap-1 sm:gap-2 ${
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

        {attachedImage && (
          <div className="relative inline-block shrink-0 self-start ml-2 mt-1">
            <img src={attachedImage} alt="Attachment" className="h-14 w-14 rounded-xl object-cover border border-border shadow-sm" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAttachedImage(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-background border border-border shadow-sm text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
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
          placeholder={t("promptPlaceholder")}
          className={`block w-full resize-none overflow-y-auto bg-transparent px-2 pb-1 text-[15px] sm:text-[16px] leading-6 outline-none transition-[min-height] duration-300 ease-out [field-sizing:content] placeholder:text-muted-foreground ${
            promptFocused || text ? "min-h-20 max-h-56" : "min-h-10 max-h-56"
          }`}
        />

        <div className="flex w-full items-center justify-between gap-1 overflow-visible">
          <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0">
            <input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={handleFileChange} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Ajouter"
              className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-secondary transition-colors hover:bg-secondary/80"
            >
              <Plus className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-0.5 rounded-full bg-secondary p-1 shrink-0">
              {allowImage && <button
                type="button"
                aria-label="Image"
                onClick={() => {
                  setMode("image");
                  focusInput();
                }}
                className={`flex items-center gap-1 sm:gap-1.5 rounded-full px-2 sm:px-3 py-1.5 ${
                  mode === "image" ? "bg-foreground text-background" : "text-muted-foreground"
                }`}
              >
                <ImageIcon className="h-4 w-4 shrink-0" />
                {mode === "image" && <span className="text-[11px] sm:text-xs font-medium">{t("image")}</span>}
              </button>}
              {allowVideo && <button
                type="button"
                aria-label="Vidéo"
                onClick={() => {
                  setMode("video");
                  setRes((r) => (r === "1080p" ? "720p" : r));
                  focusInput();
                }}
                className={`flex items-center gap-1 sm:gap-1.5 rounded-full px-2 sm:px-3 py-1.5 ${
                  mode === "video" ? "bg-foreground text-background" : "text-muted-foreground"
                }`}
              >
                <Video className="h-4 w-4 shrink-0" />
                {mode === "video" && <span className="text-[11px] sm:text-xs font-medium">{t("video")}</span>}
              </button>}
              <button
                type="button"
                aria-label="Micro"
                onClick={handleMicClick}
                className={`rounded-full px-2 sm:px-2.5 py-1.5 shrink-0 transition-colors ${
                  isListening ? "bg-red-500/20 text-red-600 animate-pulse ring-2 ring-red-500/50" : "text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                <Mic className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Emoji"
                onClick={(e) => {
                  e.preventDefault();
                  setText((prev) => prev + " ✨");
                }}
                className="rounded-full px-2 sm:px-2.5 py-1.5 text-muted-foreground shrink-0 hidden sm:block hover:bg-secondary/50 transition-colors"
              >
                <Smile className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-1.5 shrink-0 ml-auto pl-1 sm:pl-2">
            <button
              type="button"
              aria-label={t("enhance")}
              title={t("enhance")}
              onClick={(e) => {
                e.preventDefault();
                void runEnhance();
              }}
              className="group relative flex h-9 sm:h-10 items-center gap-1.5 rounded-full bg-secondary px-2 sm:px-3 text-foreground transition-colors disabled:opacity-40 shrink-0"
              disabled={!text.trim() || enhancing || busy}
            >
              {enhancing ? (
                <Loader2 className="h-4 w-4 sm:h-4 sm:w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 sm:h-4 sm:w-4" />
              )}
              <span className="hidden text-[11px] sm:text-xs font-medium sm:inline">{t("enhance")}</span>
            </button>
            <button
              type="button"
              aria-label={t("send")}
              onClick={() => void submit()}
              className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
              disabled={!text.trim() || busy || enhancing}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
      {ideasOn && !text && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-1">
          {IDEAS.map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => {
                setText(idea);
                focusInput();
              }}
              className="shrink-0 rounded-full border border-border bg-card/60 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur-xl transition-colors hover:text-foreground sm:text-xs"
            >
              💡 {idea}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 flex justify-start sm:justify-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-1">
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-secondary/80 p-1 backdrop-blur-xl">
          {(mode === "video" ? ["480p", "720p"] : ["480p", "720p", "1080p"]).map((r) => (
            <button key={r} type="button" onClick={() => setRes(r)} className={chip(res === r)}>
              {r}
            </button>
          ))}
        </div>
        {mode === "video" && (() => {
          const isFree = userPlan === "free";
          const isPlus = userPlan === "super_grok_plus";
          const isHeavy = userPlan === "superhearly_monthly" || userPlan === "superhearly";
          const activeDurations = isFree ? ["5s", "8s"] : ["5s", "8s", "10s"];
          const upcomingDurations = isHeavy
            ? ["15s", "20s", "30s"]
            : isPlus
            ? ["15s", "20s"]
            : [];

          return (
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-secondary/80 p-1 backdrop-blur-xl">
              {activeDurations.map((d) => (
                <button key={d} type="button" onClick={() => setDur(d)} className={chip(dur === d)}>
                  {d}
                </button>
              ))}
              {upcomingDurations.map((d) => (
                <span
                  key={d}
                  title="Bientôt disponible"
                  className="shrink-0 rounded-full px-2 py-1 text-[11px] sm:px-2.5 sm:py-1.5 sm:text-xs font-medium text-muted-foreground/40 cursor-not-allowed flex items-center gap-1 select-none"
                >
                  {d}
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Bientôt</span>
                </span>
              ))}
            </div>
          );
        })()}
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
