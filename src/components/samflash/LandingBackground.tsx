import { memo } from "react";

/**
 * Arrière-plan discret de la landing page, version allégée.
 * - Plus de filter: drop-shadow animé (très coûteux à peindre) : les formes sont
 *   maintenant des dégradés simples, sans ombre portée.
 * - Animation seulement sur 4 formes, et seulement sur écran large et sans
 *   prefers-reduced-motion. Sur mobile, le fond reste statique.
 * - Animations uniquement en transform et opacity (GPU).
 */
export const LandingBackground = memo(function LandingBackground() {
  return (
    <div aria-hidden="true" className="fixed inset-0 -z-10 pointer-events-none overflow-hidden select-none">
      <div className="absolute inset-0 bg-[#f8fafc]" />
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage: `
            radial-gradient(circle at 15% 15%, rgba(147, 197, 253, 0.22) 0%, transparent 45%),
            radial-gradient(circle at 85% 20%, rgba(196, 181, 253, 0.25) 0%, transparent 45%),
            radial-gradient(circle at 50% 50%, rgba(254, 215, 170, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 20% 80%, rgba(196, 181, 253, 0.20) 0%, transparent 50%),
            radial-gradient(circle at 80% 85%, rgba(147, 197, 253, 0.22) 0%, transparent 50%)
          `,
        }}
      />

      <style>{`
        @keyframes lb-float {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(12px, -18px, 0); }
        }
        .lb-shape { position: absolute; border-radius: 9999px; will-change: transform; }
        @media (min-width: 1024px) and (prefers-reduced-motion: no-preference) {
          .lb-anim { animation: lb-float 14s ease-in-out infinite; }
        }
        @media (max-width: 1023px), (prefers-reduced-motion: reduce) {
          .lb-anim { animation: none; }
        }
      `}</style>

      <div
        className="lb-shape lb-anim"
        style={{ top: "12%", left: "8%", width: 120, height: 120, background: "radial-gradient(circle at 30% 30%, #bfdbfe, #60a5fa)", opacity: 0.45 }}
      />
      <div
        className="lb-shape lb-anim"
        style={{ top: "30%", right: "10%", width: 90, height: 90, background: "radial-gradient(circle at 30% 30%, #ddd6fe, #a78bfa)", opacity: 0.45, animationDelay: "-4s" }}
      />
      <div
        className="lb-shape lb-anim"
        style={{ bottom: "18%", left: "14%", width: 70, height: 70, background: "radial-gradient(circle at 30% 30%, #fed7aa, #fb923c)", opacity: 0.4, animationDelay: "-8s" }}
      />
      <div
        className="lb-shape lb-anim"
        style={{ bottom: "10%", right: "16%", width: 100, height: 100, background: "radial-gradient(circle at 30% 30%, #bfdbfe, #3b82f6)", opacity: 0.35, animationDelay: "-11s" }}
      />
    </div>
  );
});
