import { useEffect, useMemo, useState } from "react";
import { setCreatorSelection } from "@/lib/creator-selection";
import { useServerFn } from "@tanstack/react-start";
import { getFeatureFlags } from "@/lib/feature-flags.functions";
import { isFeatureVisible, type FeatureFlags } from "@/lib/feature-flags";
import {
  CREATOR_MODELS,
  MODE_LABELS,
  needsImageUpload,
  needsVideoUpload,
  type CreatorModel,
  type VideoMode,
} from "@/lib/creator-models";

/**
 * Sélecteur placé sous le titre « Qu'allons-nous créer ? ».
 * Étapes : modèle, puis type de vidéo, puis durée.
 * Masqué tant que « creator_studio » n'est pas publié (l'admin le verra via l'interrupteur).
 */
export function CreatorModelPicker({
  onChange,
}: {
  onChange?: (sel: { model: CreatorModel; mode: VideoMode; seconds: number }) => void;
}) {
  const fetchFlags = useServerFn(getFeatureFlags);
  const [flags, setFlags] = useState<FeatureFlags>({});
  const [model, setModel] = useState<CreatorModel>(CREATOR_MODELS[0]);
  const [mode, setMode] = useState<VideoMode>(model.modes[0]);
  const [seconds, setSeconds] = useState<number>(model.durations[0]);

  useEffect(() => {
    void fetchFlags()
      .then((f) => setFlags(f))
      .catch(() => undefined);
  }, [fetchFlags]);

  useEffect(() => {
    setCreatorSelection({ modelId: model.id, mode, seconds });
    onChange?.({ model, mode, seconds });
  }, [model, mode, seconds, onChange]);

  const pickModel = (m: CreatorModel) => {
    setModel(m);
    setMode(m.modes[0]);
    setSeconds(m.durations[0]);
  };

  const hint = useMemo(() => {
    if (needsImageUpload(mode)) return "Ajoutez une photo pour ce mode.";
    if (needsVideoUpload(mode)) return "Ajoutez une vidéo pour ce mode.";
    return null;
  }, [mode]);

  if (!isFeatureVisible("creator_studio", flags, false)) return null;

  const chip = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm border transition ${
      active
        ? "bg-white text-black border-white"
        : "bg-white/5 text-white/80 border-white/15 hover:bg-white/10"
    }`;

  return (
    <div className="w-full max-w-2xl px-4 mb-4 space-y-3">
      <div>
        <p className="text-xs text-white/50 mb-2">Modèle</p>
        <div className="flex flex-wrap gap-2">
          {CREATOR_MODELS.map((m) => (
            <button key={m.id} type="button" className={chip(m.id === model.id)} onClick={() => pickModel(m)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-white/50 mb-2">Type de vidéo</p>
        <div className="flex flex-wrap gap-2">
          {model.modes.map((md) => (
            <button key={md} type="button" className={chip(md === mode)} onClick={() => setMode(md)}>
              {MODE_LABELS[md]}
            </button>
          ))}
        </div>
        {hint && <p className="text-xs text-white/50 mt-2">{hint}</p>}
      </div>

      <div>
        <p className="text-xs text-white/50 mb-2">Durée</p>
        <div className="flex flex-wrap gap-2">
          {model.durations.map((s) => (
            <button key={s} type="button" className={chip(s === seconds)} onClick={() => setSeconds(s)}>
              {s} s
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
