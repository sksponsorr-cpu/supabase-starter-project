import { creditCostFor, type CreditConfig, type Resolution } from "@/lib/credits";

/** Durée de 5 s à 10 min. Au-delà de 15 s, la vidéo est produite en plusieurs parties. */
const MIN = 5;
const MAX = 600;

export function formatDuration(s: number) {
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}

type Props = {
  value: number;
  onChange: (seconds: number) => void;
  resolution: Resolution;
  config: CreditConfig;
};

export function DurationSlider({ value, onChange, resolution, config }: Props) {
  const cost = creditCostFor("video", value, resolution, config);
  const isLong = value > 15;

  return (
    <div className="space-y-3 rounded-2xl border border-border p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">Durée</span>
        <span className="text-lg font-semibold">{formatDuration(value)}</span>
      </div>

      <input
        type="range"
        min={MIN}
        max={MAX}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
        aria-label="Durée de la vidéo"
      />

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>5 s</span>
        <span>1 min</span>
        <span>10 min</span>
      </div>

      <p className="text-sm">
        Coût : <strong>{cost.toLocaleString("fr-FR")} crédits</strong>
      </p>

      {isLong && (
        <p className="text-xs text-muted-foreground">
          Les vidéos de plus de 15 secondes sont produites en plusieurs parties, puis assemblées. Le temps de génération est plus long.
        </p>
      )}
    </div>
  );
}
