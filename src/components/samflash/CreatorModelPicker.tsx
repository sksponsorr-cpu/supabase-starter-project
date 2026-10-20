import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye } from "lucide-react";
import { getCreatorSelection, setCreatorSelection, useCreatorSelection } from "@/lib/creator-selection";
import { getFeatureFlags } from "@/lib/feature-flags.functions";
import { isFeatureVisible, type FeatureFlags } from "@/lib/feature-flags";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  CREATOR_MODELS,
  LIVE_MODES,
  needsImageUpload,
  needsVideoUpload,
  type CreatorModel,
  type VideoMode,
} from "@/lib/creator-models";

/** Libellés courts pour tenir sur un petit écran. */
const SHORT_LABELS: Record<VideoMode, string> = {
  text_to_video: "Vidéo à partir d'un texte",
  image_to_video: "Vidéo à partir d'une photo",
  reference_to_video: "Vidéo avec plusieurs photos",
  video_edit: "Modifier une vidéo",
  extend: "Prolonger une vidéo",
};

const MOTION_CSS = `
@keyframes sfPickerIn { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }
.sf-picker-in { animation: sfPickerIn .5s cubic-bezier(.22,1,.36,1) both; }
@media (prefers-reduced-motion: reduce) { .sf-picker-in { animation: none; } }
`;

/**
 * Choix du modèle, sous le titre de /app. Le type de vidéo se choisit dans Paramètres.
 * Seuls les modèles et types réellement branchés sont cliquables ; les autres sont marqués « Bientôt ».
 * La durée, la résolution et le format se choisissent dans la barre de saisie (un seul endroit).
 * Publié pour les utilisateurs seulement quand « creator_studio » est activé ; l'administrateur le voit toujours.
 */
export function CreatorModelPicker({
  onChange,
}: {
  onChange?: (sel: { model: CreatorModel; mode: VideoMode; seconds: number }) => void;
}) {
  const fetchFlags = useServerFn(getFeatureFlags);
  const isAdmin = useIsAdmin();
  const [flags, setFlags] = useState<FeatureFlags>({});
  const firstLive = CREATOR_MODELS.find((m) => m.live) ?? CREATOR_MODELS[0];
  const stored = useCreatorSelection();
  const model: CreatorModel = CREATOR_MODELS.find((m) => m.id === stored.modelId) ?? firstLive;
  const defaultMode = (m: CreatorModel): VideoMode => m.modes.find((x) => LIVE_MODES.includes(x)) ?? m.modes[0];
  // Le type de vidéo (mode) se choisit dans la feuille Paramètres de la barre de saisie ; on le lit ici.
  const mode: VideoMode = model.modes.includes(stored.mode) && LIVE_MODES.includes(stored.mode) ? stored.mode : defaultMode(model);

  useEffect(() => {
    void fetchFlags()
      .then((f) => setFlags(f))
      .catch(() => undefined);
  }, [fetchFlags]);

  const visible = isFeatureVisible("creator_studio", flags, isAdmin);
  const seconds = model.durations[0];

  useEffect(() => {
    setCreatorSelection({ modelId: model.id, mode, seconds, active: visible });
    onChange?.({ model, mode, seconds });
  }, [model, mode, seconds, visible, onChange]);

  // Quand le sélecteur disparaît, la barre de saisie reprend son fonctionnement habituel.
  useEffect(
    () => () => {
      setCreatorSelection({ ...getCreatorSelection(), active: false });
    },
    [],
  );

  const pickModel = (m: CreatorModel) => {
    if (!m.live) return;
    setCreatorSelection({ ...getCreatorSelection(), modelId: m.id });
  };

  const hint = useMemo(() => {
    if (needsImageUpload(mode)) return "Ajoutez votre photo avec le bouton + de la barre ci-dessous.";
    if (needsVideoUpload(mode)) return "Ajoutez votre vidéo avec le bouton + de la barre ci-dessous.";
    return null;
  }, [mode]);

  if (!visible) return null;

  const previewOnly = isAdmin && flags.creator_studio !== true;

  const chip = (active: boolean, disabled: boolean) =>
    `shrink-0 snap-start rounded-full px-2.5 py-1 text-[12px] font-medium transition-all duration-300 ease-out ${
      disabled
        ? "cursor-not-allowed bg-white/[0.03] text-white/30"
        : active
          ? "bg-white text-black shadow-[0_4px_18px_rgba(255,255,255,0.18)] scale-[1.03]"
          : "bg-white/[0.07] text-white/80 active:scale-95"
    }`;

  // Le choix du modèle et du mode est dans la barre de saisie : rien à afficher ici.
  return null;
}
