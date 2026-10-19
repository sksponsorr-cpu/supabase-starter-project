import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye } from "lucide-react";
import { getCreatorSelection, setCreatorSelection } from "@/lib/creator-selection";
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
  text_to_video: "Texte",
  image_to_video: "Image",
  reference_to_video: "Référence",
  video_edit: "Modifier",
  extend: "Étendre",
};

const MOTION_CSS = `
@keyframes sfPickerIn { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }
.sf-picker-in { animation: sfPickerIn .5s cubic-bezier(.22,1,.36,1) both; }
@media (prefers-reduced-motion: reduce) { .sf-picker-in { animation: none; } }
`;

/**
 * Choix du modèle et du type de vidéo, sous le titre de /app.
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
  const [model, setModel] = useState<CreatorModel>(firstLive);
  const [mode, setMode] = useState<VideoMode>(
    firstLive.modes.find((m) => LIVE_MODES.includes(m)) ?? firstLive.modes[0],
  );

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
    setModel(m);
    setMode(m.modes.find((x) => LIVE_MODES.includes(x)) ?? m.modes[0]);
  };

  const hint = useMemo(() => {
    if (needsImageUpload(mode)) return "Ajoutez votre photo avec le bouton + de la barre ci-dessous.";
    if (needsVideoUpload(mode)) return "Ajoutez votre vidéo avec le bouton + de la barre ci-dessous.";
    return null;
  }, [mode]);

  if (!visible) return null;

  const previewOnly = isAdmin && flags.creator_studio !== true;

  const chip = (active: boolean, disabled: boolean) =>
    `shrink-0 snap-start rounded-full px-3 py-1.5 text-[13px] font-medium transition-all duration-300 ease-out ${
      disabled
        ? "cursor-not-allowed bg-white/[0.03] text-white/30"
        : active
          ? "bg-white text-black shadow-[0_4px_18px_rgba(255,255,255,0.18)] scale-[1.03]"
          : "bg-white/[0.07] text-white/80 active:scale-95"
    }`;

  return (
    <div className="sf-picker-in w-full max-w-2xl px-4 mb-3">
      <style>{MOTION_CSS}</style>
      <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl">
        {previewOnly && (
          <p className="mb-2 flex items-center gap-1.5 text-[11px] text-white/50">
            <Eye className="h-3.5 w-3.5" /> Aperçu administrateur : les utilisateurs ne le voient pas encore.
          </p>
        )}

        <p className="mb-1.5 px-1 text-[11px] uppercase tracking-wider text-white/40">Modèle</p>
        <div className="-mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CREATOR_MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={!m.live}
              className={chip(m.id === model.id, !m.live)}
              onClick={() => pickModel(m)}
            >
              {m.label}
              {!m.live && <span className="ml-1.5 text-[9px] uppercase tracking-wider">Bientôt</span>}
            </button>
          ))}
        </div>

        <p className="mb-1.5 mt-3 px-1 text-[11px] uppercase tracking-wider text-white/40">Type</p>
        <div className="-mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {model.modes.map((md) => {
            const live = LIVE_MODES.includes(md);
            return (
              <button
                key={md}
                type="button"
                disabled={!live}
                className={chip(md === mode, !live)}
                onClick={() => live && setMode(md)}
              >
                {SHORT_LABELS[md]}
                {!live && <span className="ml-1.5 text-[9px] uppercase tracking-wider">Bientôt</span>}
              </button>
            );
          })}
        </div>

        {hint && <p className="mt-2 px-1 text-[12px] text-white/50">{hint}</p>}
      </div>
    </div>
  );
}
