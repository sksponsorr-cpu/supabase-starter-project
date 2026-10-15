import { useRef } from "react";
import { creditCostFor, type CreditConfig, type Resolution } from "@/lib/credits";

const MIN = 5;
const MAX = 600;

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

export function DurationSlider({ value, onChange, resolution, config }: Props) {
  const cost = creditCostFor("video", value, resolution, config);
  const isLong = value > 15;
  const pct = ((value - MIN) / (MAX - MIN)) * 100;
  const lastStep = useRef(value);

  const handle = (next: number) => {
    // Tic sonore à chaque palier de 5 secondes
    if (Math.floor(next / 5) !== Math.floor(lastStep.current / 5)) playTick();
    lastStep.current = next;
    onChange(next);
  };

  return (
    <div className="w-full rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4 backdrop-blur-xl motion-enter">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Durée</p>
          <p className="motion-value text-2xl font-semibold tabular-nums" key={value}>
            {formatDuration(value)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Coût</p>
          <p className="motion-value text-lg font-semibold tabular-nums" key={`c${cost}`}>
            {cost.toLocaleString("fr-FR")} <span className="text-xs font-normal text-muted-foreground">crédits</span>
          </p>
        </div>
      </div>

      <div className="relative h-10 select-none">
        {/* Piste */}
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 transition-[width] duration-200 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Repères 5 s · 1 min · 10 min */}
        {[0, 9.9, 100].map((p) => (
          <span
            key={p}
            className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-white/25"
            style={{ left: `${p}%` }}
          />
        ))}

        {/* Pouce lumineux */}
        <div
          className="pointer-events-none absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_4px_rgba(59,130,246,0.25),0_8px_20px_-6px_rgba(0,0,0,0.6)] transition-[left,transform] duration-200 ease-out active:scale-110"
          style={{ left: `${pct}%` }}
        />

        {/* Entrée réelle, transparente, pour le tactile et le clavier */}
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={1}
          value={value}
          onChange={(e) => handle(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Durée de la vidéo"
        />
      </div>

      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>5 s</span>
        <span>1 min</span>
        <span>10 min</span>
      </div>

      {isLong && (
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Au-delà de 15 secondes, la vidéo est produite en plusieurs parties, puis assemblée.
        </p>
      )}
    </div>
  );
}
