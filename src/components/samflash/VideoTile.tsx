import { useEffect, useRef } from "react";

const warmed = new Set<string>();

/** Précharge une vidéo (cache navigateur) pour qu'elle démarre instantanément à l'ouverture. */
export function warmVideo(url?: string | null) {
  if (!url || warmed.has(url) || typeof document === "undefined") return;
  warmed.add(url);
  const v = document.createElement("video");
  v.preload = "auto";
  v.muted = true;
  v.src = url;
  v.load();
}

/** Vignette vidéo : 1re image affichée tout de suite, lecture auto uniquement quand elle est visible. */
export function VideoTile({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
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
