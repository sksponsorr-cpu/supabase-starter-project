import { useEffect, useRef } from "react";

const warmed = new Set<string>();

/** Précharge une vidéo (cache navigateur) pour qu'elle démarre vite à l'ouverture. */
export function warmVideo(url?: string | null) {
  if (!url || warmed.has(url) || typeof document === "undefined") return;
  warmed.add(url);
  const v = document.createElement("video");
  v.preload = "auto";
  v.muted = true;
  v.src = url;
  v.load();
}

/**
 * Pause automatique des vignettes pendant qu'une vidéo est ouverte en grand.
 * Les vignettes reprennent toutes seules à la fermeture.
 */
let pauseCount = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export function usePauseTiles() {
  useEffect(() => {
    pauseCount += 1;
    notify();
    return () => {
      pauseCount -= 1;
      notify();
    };
  }, []);
}

/** Vignette vidéo : 1re image tout de suite, animée automatiquement quand elle est visible. */
export function VideoTile({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let visible = false;

    const sync = () => {
      if (visible && pauseCount === 0) void el.play().catch(() => {});
      else el.pause();
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    listeners.add(sync);

    return () => {
      io.disconnect();
      listeners.delete(sync);
    };
  }, [src]);

  return (
    <video
      ref={ref}
      src={src.includes("#") ? src : `${src}#t=0.001`}
      muted
      loop
      playsInline
      preload="metadata"
      className={className}
    />
  );
}
