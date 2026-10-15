import { useRef } from "react";
import { creditCostFor, type CreditConfig, type Resolution } from "@/lib/credits";

/** Bornes de la durée vidéo : 10 secondes à 3 minutes. */
export const DURATION_MIN = 10;
export const DURATION_MAX = 180;

export function formatDuration(s: number) {
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}

/** Petit « tic » sonore discret, joué via WebAudio (aucun fichier). Limité à un tic toutes les 90 ms. */
let lastTick = 0;
function playTick() {
  const now = performance.now();
  if (now - lastTick < 90) return;
  lastTick = now;
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.07);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
    osc.onended = () => void ctx.close();
  } catch {
    /* son indisponible : on ignore */
  }
}

type Props = {
  value: number;
  onChange: (seconds: number) => void;
  resolution: Resolution;
  config: CreditConfig;
};

/** Curseur compact en une ligne : durée, piste et coût, pour rester discret dans la barre d'outils. */
export function DurationSlider({ value, onChange, resolution, config }: Props) {
  const cost = creditCostFor("video", value, resolution, config);
  const pct = ((value - DURATION_MIN) / (DURATION_MAX - DURATION_MIN)) * 100;
  const lastStep = useRef(value);

  const handle = (next: number) => {
    // Tic sonore à chaque palier de 5 secondes
    if (Math.floor(next / 5) !== Math.floor(lastStep.current / 5)) playTick();
    lastStep.current = next;
    onChange(next);
  };

  return (
    <div className="flex h-11 w-64 shrink-0 items-center gap-2 rounded-full bg-secondary/80 py-1 pl-1 pr-3 backdrop-blur-xl">
      <span className="flex h-9 min-w-[4rem] shrink-0 items-center justify-center rounded-full bg-white px-3 text-xs font-semibold tabular-nums text-black">
        {formatDuration(value)}
      </span>

      <div className="relative h-full flex-1 select-none">
        <div className="absolute inset-x-2 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-white transition-[width] duration-150 ease-out" style={{ width: `${pct}%` }} />
        </div>
        <div
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_3px_rgba(255,255,255,0.2)] transition-[left] duration-150 ease-out"
          style={{ left: `calc(0.5rem + (100% - 1rem) * ${pct / 100})` }}
        />
        <input
          type="range"
          min={DURATION_MIN}
          max={DURATION_MAX}
          step={1}
          value={value}
          onChange={(e) => handle(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Durée de la vidéo"
        />
      </div>

      <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
        {cost.toLocaleString("fr-FR")} cr
      </span>
    </div>
  );
}
