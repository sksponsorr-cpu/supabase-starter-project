import { useEffect, useRef, useState } from "react";

const warmed = new Set<string>();

/** Précharge une vidéo (cache navigateur) pour qu'elle démarre vite à l'ouverture. */
export function warmVideo(url?: string | null) {
  if (!url || warmed.has(url) || typeof document === "undefined") return;
  warmed.add(url);
  const v = document.createElement("video");
  v.preload = "metadata";
  v.muted = true;
  v.src = url;
  v.load();
}

/**
 * Lecture fluide de la galerie :
 * - une vidéo n'est chargée que lorsqu'elle approche de l'écran ;
 * - 2 vignettes maximum jouent en même temps (le reste montre sa 1re image) ;
 * - tout est mis en pause quand une vidéo s'ouvre en grand ou quand l'onglet est caché.
 */
const MAX_PLAYING = 2;
const playing = new Set<HTMLVideoElement>();
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

/** Vignette vidéo : 1re image tout de suite, animée seulement quand elle est bien visible. */
export function VideoTile({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let visible = false;

    const release = () => {
      if (playing.delete(el)) queueMicrotask(notify);
    };

    const sync = () => {
      const wantsPlay = visible && pauseCount === 0 && !document.hidden;
      if (wantsPlay && (playing.has(el) || playing.size < MAX_PLAYING)) {
        playing.add(el);
        if (el.paused) void el.play().catch(() => {});
      } else {
        if (!el.paused) el.pause();
        release();
      }
    };

    const ioNear = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNear(true);
      },
      { rootMargin: "300px 0px" },
    );
    const ioVisible = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { threshold: 0.6 },
    );
    ioNear.observe(el);
    ioVisible.observe(el);
    listeners.add(sync);
    document.addEventListener("visibilitychange", sync);

    return () => {
      ioNear.disconnect();
      ioVisible.disconnect();
      listeners.delete(sync);
      document.removeEventListener("visibilitychange", sync);
      el.pause();
      release();
    };
  }, [src]);

  return (
    <video
      ref={ref}
      src={near ? (src.includes("#") ? src : `${src}#t=0.001`) : undefined}
      muted
      loop
      playsInline
      preload={near ? "metadata" : "none"}
      disablePictureInPicture
      disableRemotePlayback
      controlsList="nodownload nofullscreen noremoteplayback"
      onLoadedData={() => setReady(true)}
      onContextMenu={(e) => e.preventDefault()}
      className={className}
      style={{ opacity: ready ? 1 : 0, transition: "opacity 400ms ease-out" }}
    />
  );
}
