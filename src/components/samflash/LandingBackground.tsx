import { memo } from "react";

/**
 * Composant d'arrière-plan 3D discret adapté au fond sombre (bleu marine).
 * Contient 9 formes 3D flottantes (sphères, cubes isométriques, anneaux toroïdaux)
 * aux couleurs du logo (bleu indigo, violet, orange) avec une lueur (glow) discrète.
 *
 * Utilise uniquement des keyframes CSS GPU-accélérées (transform + opacity).
 * Se désactive automatiquement si prefers-reduced-motion est actif.
 */
export const LandingBackground = memo(function LandingBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 pointer-events-none overflow-hidden select-none bg-background"
      style={{ background: "var(--gradient-hero)" }}
    >
      {/* Halos diffus et lueurs ambiantes sombres (bleu marine, violet, ambre) */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: `
            radial-gradient(circle at 18% 15%, rgba(79, 70, 229, 0.28) 0%, transparent 45%),
            radial-gradient(circle at 82% 22%, rgba(147, 51, 234, 0.24) 0%, transparent 48%),
            radial-gradient(circle at 50% 52%, rgba(249, 115, 22, 0.14) 0%, transparent 52%),
            radial-gradient(circle at 15% 82%, rgba(124, 58, 237, 0.22) 0%, transparent 50%),
            radial-gradient(circle at 85% 88%, rgba(59, 130, 246, 0.25) 0%, transparent 48%)
          `,
        }}
      />

      {/* Style CSS embarqué pour les keyframes et prefers-reduced-motion */}
      <style>{`
        @keyframes float-shape-1 {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0.70; }
          50% { transform: translate3d(12px, -24px, 0) rotate(8deg); opacity: 0.85; }
        }
        @keyframes float-shape-2 {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0.65; }
          50% { transform: translate3d(-16px, 20px, 0) rotate(-10deg); opacity: 0.80; }
        }
        @keyframes float-shape-3 {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0.60; }
          50% { transform: translate3d(14px, 22px, 0) rotate(12deg); opacity: 0.75; }
        }
        @keyframes float-shape-4 {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0.65; }
          50% { transform: translate3d(-18px, -18px, 0) rotate(-8deg); opacity: 0.80; }
        }
        @keyframes float-shape-5 {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0.70; }
          50% { transform: translate3d(20px, -20px, 0) rotate(9deg); opacity: 0.85; }
        }
        @keyframes float-shape-6 {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0.60; }
          50% { transform: translate3d(-14px, 24px, 0) rotate(-12deg); opacity: 0.75; }
        }
        @keyframes float-shape-7 {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0.65; }
          50% { transform: translate3d(16px, -18px, 0) rotate(10deg); opacity: 0.80; }
        }
        @keyframes float-shape-8 {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0.60; }
          50% { transform: translate3d(-16px, -22px, 0) rotate(-7deg); opacity: 0.75; }
        }
        @keyframes float-shape-9 {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0.65; }
          50% { transform: translate3d(15px, 18px, 0) rotate(11deg); opacity: 0.80; }
        }

        .floating-shape-1 { animation: float-shape-1 20s ease-in-out infinite; will-change: transform, opacity; }
        .floating-shape-2 { animation: float-shape-2 23s ease-in-out infinite; will-change: transform, opacity; }
        .floating-shape-3 { animation: float-shape-3 26s ease-in-out infinite; will-change: transform, opacity; }
        .floating-shape-4 { animation: float-shape-4 22s ease-in-out infinite; will-change: transform, opacity; }
        .floating-shape-5 { animation: float-shape-5 25s ease-in-out infinite; will-change: transform, opacity; }
        .floating-shape-6 { animation: float-shape-6 24s ease-in-out infinite; will-change: transform, opacity; }
        .floating-shape-7 { animation: float-shape-7 19s ease-in-out infinite; will-change: transform, opacity; }
        .floating-shape-8 { animation: float-shape-8 27s ease-in-out infinite; will-change: transform, opacity; }
        .floating-shape-9 { animation: float-shape-9 21s ease-in-out infinite; will-change: transform, opacity; }

        @media (prefers-reduced-motion: reduce) {
          .floating-shape-1,
          .floating-shape-2,
          .floating-shape-3,
          .floating-shape-4,
          .floating-shape-5,
          .floating-shape-6,
          .floating-shape-7,
          .floating-shape-8,
          .floating-shape-9 {
            animation: none !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* 1. Sphère Bleu Indigo Luminous (Haut Gauche) */}
      <div
        className="floating-shape-1 absolute left-[4%] top-[7%]"
        style={{ filter: "drop-shadow(0 0 24px rgba(79, 70, 229, 0.45)) drop-shadow(0 15px 25px rgba(0, 0, 0, 0.6))" }}
      >
        <svg width="86" height="86" viewBox="0 0 100 100" fill="none">
          <defs>
            <radialGradient id="sphere-blue-grad" cx="35%" cy="32%" r="65%">
              <stop offset="0%" stopColor="#c7d2fe" stopOpacity="0.95" />
              <stop offset="28%" stopColor="#818cf8" />
              <stop offset="68%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#1e1b4b" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="46" fill="url(#sphere-blue-grad)" />
        </svg>
      </div>

      {/* 2. Cube Isométrique Violet (Haut Droite) */}
      <div
        className="floating-shape-2 absolute right-[7%] top-[11%]"
        style={{ filter: "drop-shadow(0 0 24px rgba(168, 85, 247, 0.45)) drop-shadow(0 15px 25px rgba(0, 0, 0, 0.6))" }}
      >
        <svg width="84" height="84" viewBox="0 0 100 100" fill="none">
          <defs>
            <linearGradient id="cube-violet-top" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e9d5ff" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
            <linearGradient id="cube-violet-left" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#7e22ce" />
            </linearGradient>
            <linearGradient id="cube-violet-right" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#7e22ce" />
              <stop offset="100%" stopColor="#3b0764" />
            </linearGradient>
          </defs>
          {/* Face Supérieure */}
          <polygon points="50,15 85,32 50,49 15,32" fill="url(#cube-violet-top)" />
          {/* Face Gauche */}
          <polygon points="15,32 50,49 50,85 15,68" fill="url(#cube-violet-left)" />
          {/* Face Droite */}
          <polygon points="50,49 85,32 85,68 50,85" fill="url(#cube-violet-right)" />
        </svg>
      </div>

      {/* 3. Anneau / Torus Orange Ambre (Milieu Droite) */}
      <div
        className="floating-shape-3 absolute right-[4%] top-[34%]"
        style={{ filter: "drop-shadow(0 0 24px rgba(249, 115, 22, 0.40)) drop-shadow(0 15px 25px rgba(0, 0, 0, 0.6))" }}
      >
        <svg width="100" height="100" viewBox="0 0 120 120" fill="none">
          <defs>
            <linearGradient id="ring-orange-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fed7aa" />
              <stop offset="35%" stopColor="#fb923c" />
              <stop offset="70%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#7c2d12" />
            </linearGradient>
          </defs>
          <ellipse
            cx="60"
            cy="60"
            rx="46"
            ry="28"
            transform="rotate(-25 60 60)"
            stroke="url(#ring-orange-grad)"
            strokeWidth="18"
            fill="none"
          />
        </svg>
      </div>

      {/* 4. Anneau / Torus Bleu Cyan (Milieu Gauche) */}
      <div
        className="floating-shape-4 absolute left-[3%] top-[42%]"
        style={{ filter: "drop-shadow(0 0 24px rgba(59, 130, 246, 0.40)) drop-shadow(0 15px 25px rgba(0, 0, 0, 0.6))" }}
      >
        <svg width="95" height="95" viewBox="0 0 120 120" fill="none">
          <defs>
            <linearGradient id="ring-blue-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#bfdbfe" />
              <stop offset="50%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
          </defs>
          <ellipse
            cx="60"
            cy="60"
            rx="44"
            ry="26"
            transform="rotate(30 60 60)"
            stroke="url(#ring-blue-grad)"
            strokeWidth="16"
            fill="none"
          />
        </svg>
      </div>

      {/* 5. Sphère Violet Luminous (Centre Droite) */}
      <div
        className="floating-shape-5 absolute right-[10%] top-[56%]"
        style={{ filter: "drop-shadow(0 0 28px rgba(147, 51, 234, 0.45)) drop-shadow(0 18px 28px rgba(0, 0, 0, 0.6))" }}
      >
        <svg width="105" height="105" viewBox="0 0 100 100" fill="none">
          <defs>
            <radialGradient id="sphere-violet-grad" cx="32%" cy="30%" r="68%">
              <stop offset="0%" stopColor="#f3e8ff" stopOpacity="0.95" />
              <stop offset="25%" stopColor="#d8b4fe" />
              <stop offset="65%" stopColor="#9333ea" />
              <stop offset="100%" stopColor="#3b0764" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="46" fill="url(#sphere-violet-grad)" />
        </svg>
      </div>

      {/* 6. Cube Isométrique Orange (Bas Gauche) */}
      <div
        className="floating-shape-6 absolute left-[6%] top-[66%]"
        style={{ filter: "drop-shadow(0 0 24px rgba(249, 115, 22, 0.40)) drop-shadow(0 15px 25px rgba(0, 0, 0, 0.6))" }}
      >
        <svg width="78" height="78" viewBox="0 0 100 100" fill="none">
          <defs>
            <linearGradient id="cube-orange-top" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffedd5" />
              <stop offset="100%" stopColor="#fdba74" />
            </linearGradient>
            <linearGradient id="cube-orange-left" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fb923c" />
              <stop offset="100%" stopColor="#c2410c" />
            </linearGradient>
            <linearGradient id="cube-orange-right" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#7c2d12" />
            </linearGradient>
          </defs>
          <polygon points="50,15 85,32 50,49 15,32" fill="url(#cube-orange-top)" />
          <polygon points="15,32 50,49 50,85 15,68" fill="url(#cube-orange-left)" />
          <polygon points="50,49 85,32 85,68 50,85" fill="url(#cube-orange-right)" />
        </svg>
      </div>

      {/* 7. Sphère Bleu Ciel (Bas Droite) */}
      <div
        className="floating-shape-7 absolute right-[8%] top-[80%]"
        style={{ filter: "drop-shadow(0 0 22px rgba(14, 165, 233, 0.40)) drop-shadow(0 15px 25px rgba(0, 0, 0, 0.6))" }}
      >
        <svg width="74" height="74" viewBox="0 0 100 100" fill="none">
          <defs>
            <radialGradient id="sphere-cyan-grad" cx="35%" cy="30%" r="65%">
              <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.95" />
              <stop offset="30%" stopColor="#7dd3fc" />
              <stop offset="70%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#082f49" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="46" fill="url(#sphere-cyan-grad)" />
        </svg>
      </div>

      {/* 8. Anneau / Torus Violet Profond (Bas Gauche) */}
      <div
        className="floating-shape-8 absolute left-[9%] top-[88%]"
        style={{ filter: "drop-shadow(0 0 24px rgba(147, 51, 234, 0.40)) drop-shadow(0 15px 25px rgba(0, 0, 0, 0.6))" }}
      >
        <svg width="88" height="88" viewBox="0 0 120 120" fill="none">
          <defs>
            <linearGradient id="ring-violet-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f3e8ff" />
              <stop offset="50%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#7e22ce" />
            </linearGradient>
          </defs>
          <ellipse
            cx="60"
            cy="60"
            rx="42"
            ry="24"
            transform="rotate(-20 60 60)"
            stroke="url(#ring-violet-grad)"
            strokeWidth="15"
            fill="none"
          />
        </svg>
      </div>

      {/* 9. Sphère Orange Luminous (Haut-Milieu Gauche) */}
      <div
        className="floating-shape-9 absolute left-[12%] top-[24%]"
        style={{ filter: "drop-shadow(0 0 24px rgba(249, 115, 22, 0.40)) drop-shadow(0 15px 25px rgba(0, 0, 0, 0.6))" }}
      >
        <svg width="78" height="78" viewBox="0 0 100 100" fill="none">
          <defs>
            <radialGradient id="sphere-orange-grad" cx="33%" cy="32%" r="67%">
              <stop offset="0%" stopColor="#ffedd5" stopOpacity="0.95" />
              <stop offset="28%" stopColor="#fb923c" />
              <stop offset="70%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#7c2d12" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="46" fill="url(#sphere-orange-grad)" />
        </svg>
      </div>
    </div>
  );
});
