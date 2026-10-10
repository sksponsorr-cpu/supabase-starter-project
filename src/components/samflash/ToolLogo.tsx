import { useState } from "react";

/**
 * Logo d'un outil. Place le logo officiel dans public/tools/ avec le nom indiqué
 * (ex. public/tools/claude.png). Tant qu'il n'existe pas, une pastille avec l'initiale s'affiche.
 */
export function ToolLogo({ src, name, className = "" }: { src: string; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        aria-label={name}
        className={`flex items-center justify-center rounded-2xl bg-secondary text-2xl font-semibold text-foreground ${className}`}
      >
        {name.charAt(0)}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={`Logo ${name}`}
      onError={() => setFailed(true)}
      className={`rounded-2xl object-contain ${className}`}
    />
  );
}
