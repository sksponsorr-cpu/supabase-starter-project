import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Image as ImageIcon, Video, Smile, ArrowUp, Loader2, Sparkles, Mic, X, SlidersHorizontal, ChevronRight } from "lucide-react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { generateMedia, checkGenerationStatus, cancelGeneration, getVideoMaxSeconds } from "@/lib/generation.functions";
import { launchLongVideo } from "@/lib/long-jobs.functions";
import { getPublicCreditConfig } from "@/lib/credits-public.functions";
import { DEFAULT_CREDIT_CONFIG, creditCostFor, type CreditConfig, type Resolution } from "@/lib/credits";
import { clipMaxSeconds } from "@/lib/plans";
import { updateProjectTitle } from "@/lib/project.functions";
import { getGenerationAccess } from "@/lib/device.functions";
import { enhancePrompt } from "@/lib/prompt.functions";
import { useI18n } from "@/lib/i18n";
import { playChime } from "@/lib/chime";
import { toast } from "@/lib/toast";
import { useLocation } from "@tanstack/react-router";
import { NoticeBanner, noticeKind } from "@/components/samflash/NoticeBanner";
import { notifyDone, optionOn, speak, usePrefs } from "@/lib/prefs";
import { getCreatorSelection, setCreatorSelection, useCreatorSelection, modelOf } from "@/lib/creator-selection";
import { CREATOR_MODELS, LIVE_MODES, MODE_LABELS, needsImageUpload, needsVideoUpload, type VideoMode } from "@/lib/creator-models";
import { isPricedModel, generationCreditsFor } from "@/lib/creator-pricing";
import { notifyProfileChanged } from "@/lib/seller-mode";
import { clipCapFor, modelMaxSeconds } from "@/lib/video-duration-limits";
import { SupportWhatsAppButton } from "@/components/samflash/SupportWhatsAppButton";

const IDEAS = [
  "Un astronaute qui marche sur une plage au coucher du soleil",
  "Un chat samouraï sous la pluie dans une ruelle de Tokyo néon",
  "Une voiture de sport qui traverse un désert, plan drone",
  "Un marché africain coloré à l'heure dorée, ambiance sonore vivante",
];
const MEMORY_KEY = "samflash:composer";

/** Abonnés et clients ayant déjà acheté : le moteur est indisponible, les crédits ne sont pas débités. */
const PAID_RETRY_MESSAGE =
  "Votre génération n'a pas été lancée et vos crédits ne sont pas décomptés. Notre équipe technique met en place un nouveau système. Veuillez réessayer dans quelques minutes.";

/** Comptes gratuits : invitation claire à passer à une offre payante. */
const FREE_UPGRADE_MESSAGE =
  "Pour générer des vidéos avec le modèle de votre choix, passez au forfait supérieur. Vous bénéficiez de 50 crédits offerts dès votre premier achat. Vous pouvez aussi contacter notre support pour obtenir votre code promo.";

/** Messages du serveur qui indiquent quoi faire (à conserver tels quels). */
const KEEP_SERVER_MESSAGE = /réservée aux abonnés|limitées à|Crédits insuffisants|quota/i;

function isEngineBalanceError(message?: string | null): boolean {
  return !!message && /insufficient|balance|payment required|402|solde insuffisant|fonds insuffisants/i.test(message);
}

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
    | "subscription_expired"
    | "insufficient_credits",
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
  if (code === "insufficient_credits") {
    return "Crédits insuffisants. Rechargez votre compte pour continuer.";
  }
  if (code === "subscription_expired") {
    return "Votre abonnement a expiré. Renouvelez-le pour continuer !";
  }
  return "Votre quota est épuisé pour aujourd'hui.";
}

/** Titre clair pour l'offre gratuite quand la limite est atteinte. */
function freeTitle(code: string, msg: string, free: boolean) {
  return free && (code === "subscription_required" || code === "device_free_used")
    ? `Offre gratuite terminée\n\n${msg}`
    : msg;
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
  const [longSec, setLongSec] = useState(10);
  // Durée choisie uniquement dans les paramètres, selon les durées du modèle.
  const showSlider = false;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creditCfg, setCreditCfg] = useState<CreditConfig>(DEFAULT_CREDIT_CONFIG);
  const fetchCreditCfg = useServerFn(getPublicCreditConfig);
  const launchLong = useServerFn(launchLongVideo);
  useEffect(() => {
    fetchCreditCfg()
      .then((c) => setCreditCfg({ ...DEFAULT_CREDIT_CONFIG, ...c }))
      .catch(() => {});
  }, [fetchCreditCfg]);
  const [userPlan, setUserPlan] = useState<string>("free");
  // Gratuit : 1 minute maximum. Au-delà, un cadenas invite à passer à un abonnement.
  const lockedMaxSec = clipMaxSeconds(userPlan);
  const [ratio, setRatio] = useState("2:3");
  const [mode, setMode] = useState<"image" | "video">("video");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [supportVisible, setSupportVisible] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [promptFocused, setPromptFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const attachedImage = attachedImages[0] ?? null;
  const MAX_PHOTOS = 9;
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Référence à l'instance SpeechRecognition en cours, pour pouvoir l'arrêter
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  /** Redimensionne une photo (1920 px max) et renvoie une data URL JPEG. */
  const compressPhoto = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Lecture impossible"));
      reader.onload = (event) => {
        const img = new Image();
        img.onerror = () => reject(new Error("Image illisible"));
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
          if (!ctx) return reject(new Error("Canvas indisponible"));
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const room = Math.max(0, MAX_PHOTOS - attachedImages.length);
    try {
      const added = await Promise.all(files.slice(0, room).map(compressPhoto));
      setAttachedImages((prev) => [...prev, ...added].slice(0, MAX_PHOTOS));
    } catch {
      toast.error("Une photo n'a pas pu être lue.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
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

  // Cartes du mode vendeur : règle le type, le modèle et le mode vidéo, puis pré-remplit la saisie.
  // Recréation depuis le modèle : prépare le compositeur existant et réutilise le moteur normal.
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("sf:clone-prefill");
      if (!raw) return;
      const d = JSON.parse(raw) as { photos?: string[]; photo?: string | null; prompt?: string };
      const images = Array.isArray(d.photos) ? d.photos : d.photo ? [d.photo] : [];
      if (!images.length || !d.prompt) return;
      setMode("video");
      setRes("720p");
      setDur("30s");
      setRatio("9:16");
      setAttachedImages(images.slice(0, MAX_PHOTOS));
      setCreatorSelection({ modelId: "seedance-2-5", mode: "reference_to_video", seconds: 30, active: true });
      setText(d.prompt);
      window.sessionStorage.removeItem("sf:clone-prefill");
      window.setTimeout(() => inputRef.current?.focus(), 150);
      toast.success("Modèle préparé : vérifie les paramètres puis lance la génération.");
    } catch (error) {
      console.error("Impossible de charger le modèle à recréer", error);
      toast.error("Impossible de préparer le modèle vidéo.");
    }
  }, []);

  useEffect(() => {
    const onPreset = (e: Event) => {
      const d = (e as CustomEvent<{ text: string; mediaType: "image" | "video"; modelId?: string; videoMode?: VideoMode; images?: string[] }>).detail;
      if (!d) return;
      setMode(d.mediaType);
      if (d.images && d.images.length > 0) setAttachedImages(d.images);
      if (d.mediaType === "video" && d.modelId && d.videoMode) {
        const cur = getCreatorSelection();
        setCreatorSelection({ modelId: d.modelId, mode: d.videoMode, seconds: cur.seconds, active: true });
      }
      setText(d.text);
      window.setTimeout(() => inputRef.current?.focus(), 50);
    };
    window.addEventListener("samflash:seller-preset", onPreset);
    return () => window.removeEventListener("samflash:seller-preset", onPreset);
  }, []);

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
    // Un mode qui demande une photo ne part pas sans photo (sinon il deviendrait une création texte).
    if (creatorSel.active && mode === "video" && needsImageUpload(creatorSel.mode) && attachedImages.length === 0) {
      setSent("Ajoutez une photo pour ce mode, avec le bouton +.");
      return;
    }

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
        // Message du serveur conservé tel quel (vidéo réservée aux abonnés, durée max, etc.)
        setSent(freeTitle(access.code, message, userPlan === "free"));
        // Le message reste affiché avec un bouton vers les offres, pour tous les comptes.
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

    if (mode === "video" && longSec > 15) {
      const r = await launchLong({
        data: {
          prompt: finalPrompt,
          seconds: longSec,
          resolution: (res === "480p" ? "480p" : "720p") as Resolution,
          modelId: creatorSel.active ? creatorSel.modelId : null,
        },
      });
      setBusy(false);
      setSent(null);
      if (r.ok) {
        toast.success("Vidéo longue lancée. Suivez la progression dans Mes créations.");
        onGenerated?.();
      } else {
        // Erreur d'échec de lancement : même affichage et même bouton d'aide que les autres erreurs.
        // Abonnés : le même message que pour les autres échecs de génération.
        setSent(userPlan === "free" ? FREE_UPGRADE_MESSAGE : PAID_RETRY_MESSAGE);
        setSupportVisible(true);
      }
      return;
    }

    let isDone = false;
    try {
      const result = await generate({
        data: { prompt: finalPrompt, mediaType: mode, resolution: res, duration: dur, aspectRatio: ratio, imageUrl: attachedImage, imageUrls: attachedImages.length > 1 ? attachedImages : null, creatorMode: getCreatorSelection().active && getCreatorSelection().mode === "reference_to_video" ? "reference" : null, project_id: currentProjectId, model: getCreatorSelection().active ? getCreatorSelection().modelId : null },
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
            setSent(userPlan === "free" ? FREE_UPGRADE_MESSAGE : PAID_RETRY_MESSAGE);
          }
        }
      } else if (result.reason === "quota") {
        playChime("error");
        setText(prompt);
        const message = result.message ?? quotaMessage(result.code, result.retryAt, result.remainingSeconds);
        setSent(freeTitle(result.code, message, userPlan === "free"));
        // Le bouton « Voir les offres » est affiché dans le bandeau.
      } else {
        playChime("error");
        setText(prompt);
        
        // Gérer le message selon le type d'utilisateur
        let errorMessage = result.message ?? (userPlan === "free" ? "L'offre gratuite est terminée pour l'instant. Réessayez plus tard ou passez à un forfait supérieur." : "Une erreur est survenue pendant la génération. Réessayez. Vos crédits ne sont pas décomptés.");
        
        if (result.message === "SERVICE_UNAVAILABLE") {
          if (userPlan === "free") {
            errorMessage = "L'offre gratuite est momentanément en pause.\n\nVotre vidéo et vos images offertes ne sont pas décomptées.\n\nAbonnez-vous dès maintenant : vos générations reprennent dès la reprise du service, avec des jours supplémentaires offerts.";
          } else {
            errorMessage = "Votre abonnement est bien actif, mais la génération est momentanément indisponible.\n\nVos crédits ne sont pas décomptés.\nPour vous remercier de votre patience, des jours supplémentaires vous sont offerts.\n\nRéessayez un peu plus tard. Si le problème dure, contactez-nous.\n\nMerci de votre confiance.";
          }
        }
        
        // Messages d'échec génériques ou techniques : on affiche les messages prévus par le produit.
        // Les messages actionnables du serveur (quota, réservé aux abonnés, limites, crédits) sont conservés.
        if (!KEEP_SERVER_MESSAGE.test(result.message ?? "") || isEngineBalanceError(result.message)) {
          errorMessage = userPlan === "free" ? FREE_UPGRADE_MESSAGE : PAID_RETRY_MESSAGE;
        }
        if (debug && result.message && result.message !== "SERVICE_UNAVAILABLE") {
          errorMessage += `\n\nDétail technique : ${result.message}`;
        }
        setSupportVisible(true);
        setSent(errorMessage);
      }
    } catch (error) {
      if (!isDone) {
        console.error("[PromptBar] Generation error:", error);
        playChime("error");
        setText(prompt);
        // Erreur inattendue : message persistant, pas de setTimeout
        setSent(userPlan === "free" ? FREE_UPGRADE_MESSAGE : PAID_RETRY_MESSAGE);
      }
    } finally {
      setBusy(false);
      onSettled?.();
      // ⚠️ Pas de setSent(null) ici : les messages d'erreur doivent rester visibles
      // jusqu'à ce que l'utilisateur relance une génération ou ferme le bandeau (bouton ✕).
    }
  };

  // Coût affiché à côté du bouton d'envoi (même calcul que celui du serveur quand le modèle est tarifé).
  const creatorSel = useCreatorSelection();
  const costSeconds = mode === "video" ? (longSec > 15 ? longSec : Number(dur.replace(/\D/g, "")) || 5) : 0;
  let costCredits: number | null = null;
  try {
    if (mode === "video" && creatorSel.active && isPricedModel(creatorSel.modelId)) {
      costCredits = generationCreditsFor(creatorSel.modelId, (res === "1080p" ? "1080p" : res === "480p" ? "480p" : "720p"), costSeconds);
    }
    if (costCredits === null) {
      costCredits = creditCostFor(mode, costSeconds, res, creditCfg);
    }
  } catch {
    costCredits = null;
  }

  // Le bouton + (photo ou vidéo) n'apparaît que si le mode choisi en a besoin.
  const showAttach =
    mode === "image" || !creatorSel.active || needsImageUpload(creatorSel.mode) || needsVideoUpload(creatorSel.mode);
  // En mode texte, on retire les photos déjà ajoutées pour ne pas les envoyer par erreur.
  useEffect(() => {
    if (!showAttach && attachedImages.length > 0) setAttachedImages([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAttach]);

  // Options de la feuille Paramètres : elles dépendent du modèle et du mode choisis.
  const cModel = mode === "video" && creatorSel.active ? modelOf(creatorSel) : null;
  // Durée par vidéo : min(limite du modèle, limite de l'offre). Le quota quotidien n'intervient pas ici.
  const planMaxSec = clipCapFor(userPlan, cModel?.id);
  const allDurs = cModel
    ? cModel.durations.filter((d) => d <= modelMaxSeconds(cModel.id))
    : [5, 8, 10, 15];
  const durOptions = allDurs.filter((d) => d <= planMaxSec);
  const safeDurOptions = durOptions.length > 0 ? durOptions : allDurs.slice(0, 1);
  const resOptions: string[] =
    mode === "video"
      ? (cModel ? ["480p", "720p"].filter((r) => (cModel.resolutions as string[]).includes(r)) : ["480p", "720p"])
      : ["480p", "720p", "1080p"];
  const safeResOptions = resOptions.length > 0 ? resOptions : ["720p"];
  const modeOptions = cModel ? cModel.modes.filter((m) => LIVE_MODES.includes(m)) : [];

  // Quand le modèle change, on garde uniquement une durée et une qualité qu'il accepte.
  useEffect(() => {
    if (!cModel || showSlider) return;
    const d = parseInt(dur, 10);
    if (!safeDurOptions.includes(d)) {
      setDur(`${safeDurOptions[0]}s`);
      setLongSec(safeDurOptions[0]);
      // Ajustement visible, jamais silencieux.
      setSent(`Durée ajustée à ${safeDurOptions[0]} s : votre offre permet jusqu'à ${planMaxSec} s par vidéo.`);
    }
    if (!safeResOptions.includes(res)) setRes(safeResOptions[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatorSel.modelId, creatorSel.active, mode]);

  const optionsRef = useRef<HTMLDivElement | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const updateScrollHint = useCallback(() => {
    const el = optionsRef.current;
    if (!el) return;
    setShowScrollHint(el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
  }, []);
  useEffect(() => {
    updateScrollHint();
    window.addEventListener("resize", updateScrollHint);
    return () => window.removeEventListener("resize", updateScrollHint);
  }, [updateScrollHint, mode, creatorSel.active, allowImage, allowVideo]);

  return (
    <div className="w-full max-w-3xl mx-auto mb-10 mt-6 px-4">
      <SupportWhatsAppButton visible={supportVisible && !!sent} onDismiss={() => setSupportVisible(false)} />
      {sent && (
        <NoticeBanner
          message={sent}
          onClose={() => setSent(null)}
          action={
            sent.startsWith("Crédits insuffisants") || sent.startsWith("L'offre gratuite est terminée") || sent.includes("réservée aux abonnés") || sent.includes("limitées à")
              ? { label: "Voir les offres", onClick: () => onQuotaExceeded?.() }
              : userPlan === "free" && noticeKind(sent) === "warning"
                ? { label: "Passer au forfait supérieur", onClick: () => onQuotaExceeded?.() }
                : undefined
          }
        />
      )}

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

        {attachedImages.length > 0 && (
          <div className="ml-2 mt-1 flex items-center gap-2 self-start overflow-x-auto">
            {attachedImages.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`Photo ${i + 1}`}
                className="h-14 w-14 shrink-0 rounded-xl object-cover border border-border shadow-sm"
              />
            ))}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAttachedImages([]);
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="flex h-6 shrink-0 items-center justify-center rounded-full bg-background border border-border px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Retirer ({attachedImages.length})
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

        <div className="relative flex w-full items-center justify-between gap-1 overflow-visible">
          {/* Indicateur : il reste des options à faire défiler vers la droite */}
          {showScrollHint && (
            <span aria-hidden className="pointer-events-none absolute right-14 top-1/2 z-10 flex -translate-y-1/2 items-center gap-0.5 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground shadow-lg animate-pulse sm:hidden">
              Glisse
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          )}
          <div ref={optionsRef} onScroll={updateScrollHint} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <input type="file" accept="image/*" multiple className="hidden" ref={fileRef} onChange={handleFileChange} />
            {showAttach && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Ajouter"
                className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-secondary transition-colors hover:bg-secondary/80"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
            {creatorSel.active && mode === "video" && (
              <label className="flex h-9 sm:h-10 shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3 text-xs font-medium">
                <Video className="h-3.5 w-3.5 shrink-0" />
                <select
                  aria-label="Modèle"
                  value={creatorSel.modelId}
                  onChange={(e) => setCreatorSelection({ ...getCreatorSelection(), modelId: e.target.value })}
                  className="max-w-[6.5rem] truncate bg-transparent text-xs font-medium outline-none"
                >
                  {CREATOR_MODELS.filter((m) => m.live).map((m) => (
                    <option key={m.id} value={m.id} className="text-black">
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {mode === "video" && (
              <button
                type="button"
                aria-label="Paramètres"
                onClick={() => setSettingsOpen(true)}
                className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-secondary"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            )}
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
            {costCredits !== null && (
              <span
                className="flex h-9 sm:h-10 shrink-0 items-center rounded-full bg-secondary px-2.5 text-[11px] sm:text-xs font-semibold tabular-nums text-foreground"
                title="Crédits utilisés pour cette création"
              >
                {costCredits} cr.
              </span>
            )}
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
      <button
        type="button"
        onClick={() => {
          try {
            window.localStorage.setItem("sam-flash-profile", "seller");
          } catch {
            /* ignoré */
          }
          notifyProfileChanged();
          window.location.assign("/vendeur");
        }}
        className="mx-auto mt-4 flex w-full max-w-sm items-center justify-between gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-left backdrop-blur-xl transition-transform active:scale-[0.98]"
      >
        <span className="flex items-center gap-2 whitespace-nowrap text-[13px] font-semibold text-[#d4ff00]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#d4ff00] opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#d4ff00]" />
          </span>
          Passer en mode vendeur
        </span>
      </button>

      {settingsOpen && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[100]" role="dialog" aria-label="Paramètres">
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => setSettingsOpen(false)}
              className="absolute inset-0 bg-black/60 animate-in fade-in duration-200"
            />
            <div className="absolute inset-x-0 bottom-0 mx-auto max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-t-[28px] border border-border bg-card p-5 pb-8 animate-in slide-in-from-bottom duration-300">
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted-foreground/30" />
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold">Paramètres</h2>
                <button
                  type="button"
                  aria-label="Fermer"
                  onClick={() => setSettingsOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {modeOptions.length > 0 && (
                <div className="border-t border-border py-4">
                  <p className="mb-2 text-xs text-muted-foreground">Mode</p>
                  <div className="flex flex-wrap gap-2">
                    {modeOptions.map((md) => (
                      <button
                        key={md}
                        type="button"
                        onClick={() => setCreatorSelection({ ...getCreatorSelection(), mode: md })}
                        className={chip(creatorSel.mode === md)}
                      >
                        {MODE_LABELS[md]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {mode === "video" && (
                <div className="border-t border-border py-4">
                  <p className="mb-2 text-xs text-muted-foreground">Durée</p>
                  <div className="flex flex-wrap gap-2">
                    {allDurs.map((d) => {
                      const locked = d > planMaxSec;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            if (locked) {
                              setSent(`${d} s demande une offre supérieure. Passe à l'offre supérieure pour ${d} s par vidéo.`);
                              return;
                            }
                            setDur(`${d}s`);
                            setLongSec(d);
                          }}
                          className={chip(parseInt(dur, 10) === d)}
                        >
                          {locked ? "🔒 " : ""}{d} s
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="border-t border-border py-4">
                <p className="mb-2 text-xs text-muted-foreground">Qualité</p>
                <div className="flex flex-wrap gap-2">
                  {safeResOptions.map((r) => (
                    <button key={r} type="button" onClick={() => setRes(r)} className={chip(res === r)}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-border py-4">
                <p className="mb-2 text-xs text-muted-foreground">Format</p>
                <div className="flex flex-wrap gap-2">
                  {["9:16", "2:3", "3:4", "1:1", "16:9"].map((r) => (
                    <button key={r} type="button" onClick={() => setRatio(r)} className={chip(ratio === r)}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {costCredits !== null && (
                <p className="pb-3 text-center text-xs text-muted-foreground">
                  Cette création utilisera <span className="font-semibold text-foreground">{costCredits} crédits</span>
                </p>
              )}
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
              >
                Appliquer
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
        }
