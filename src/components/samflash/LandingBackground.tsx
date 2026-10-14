import { memo } from "react";

/**
 * Composant réutilisable d'arrière-plan 3D discret pour la landing page.
 * Contient 9 formes 3D flottantes (sphères, cubes isométriques, anneaux)
 * aux couleurs pastel du logo (bleu, violet, orange) en harmonie avec le fond clair.
 *
 * Utilise uniquement des keyframes CSS GPU-accélérées (transform + opacity).
 * Se désactive automatiquement si prefers-reduced-motion est actif.
 */
export const LandingBackground = memo(function LandingBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 pointer-events-none overflow-hidden select-none"
    >
      {/* Fond lumineux avec halos diffus subtils */}
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

      {/* Style CSS embarqué pour les keyframes et prefers-reduced-motion */}
      <style>{`
        @keyframes float-shape-1 {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0.65; }
          50% { transform: translate3d(12px, -24px, 0) rotate(8deg); opacity: 0.8; }
        }
        @keyframes float-shape-2 {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0.6; }
          50% { transform: translate3d(-16px, 20px, 0) rotate(-10deg); opacity: 0.75; }
        }
        @keyframes float-shape-3 {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0.55; }
          50% { transform: translate3d(14px, 22px, 0) rotate(12deg); opacity: 0.7; }
        }
        @keyframes float-shape-4 {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0.6; }
          50% { transform: translate3d(-18px, -18px, 0) rotate(-8deg); opacity: 0.75; }
        }
        @keyframes float-shape-5 {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0.65; }
          50% { transform: translate3d(20px, -20px, 0) rotate(9deg); opacity: 0.8; }
        }
        @keyframes float-shape-6 {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0.55; }
          50% { transform: translate3d(-14px, 24px, 0) rotate(-12deg); opacity: 0.7; }
        }
        @keyframes float-shape-7 {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0.6; }
          50% { transform: translate3d(16px, -18px, 0) rotate(10deg); opacity: 0.75; }
        }
        @keyframes float-shape-8 {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0.55; }
          50% { transform: translate3d(-16px, -22px, 0) rotate(-7deg); opacity: 0.7; }
        }
        @keyframes float-shape-9 {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0.6; }
          50% { transform: translate3d(15px, 18px, 0) rotate(11deg); opacity: 0.75; }
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

      {/* 1. Sphère Bleu Pastel (Haut Gauche) */}
      <div
        className="floating-shape-1 absolute left-[4%] top-[7%]"
        style={{ filter: "drop-shadow(0 14px 20px rgba(59, 130, 246, 0.20))" }}
      >
        <svg width="86" height="86" viewBox="0 0 100 100" fill="none">
          <defs>
            <radialGradient id="sphere-blue-grad" cx="35%" cy="32%" r="65%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="25%" stopColor="#bfdbfe" />
              <stop offset="70%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#2563eb" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="46" fill="url(#sphere-blue-grad)" />
        </svg>
      </div>

      {/* 2. Cube Isométrique Violet Pastel (Haut Droite) */}
      <div
        className="floating-shape-2 absolute right-[7%] top-[11%]"
        style={{ filter: "drop-shadow(0 16px 24px rgba(139, 92, 246, 0.22))" }}
      >
        <svg width="84" height="84" viewBox="0 0 100 100" fill="none">
          <defs>
            <linearGradient id="cube-violet-top" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f5f3ff" />
              <stop offset="100%" stopColor="#ddd6fe" />
            </linearGradient>
            <linearGradient id="cube-violet-left" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#c4b5fd" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
            <linearGradient id="cube-violet-right" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#6d28d9" />
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

      {/* 3. Anneau / Torus Orange Pastel (Milieu Droite) */}
      <div
        className="floating-shape-3 absolute right-[4%] top-[34%]"
        style={{ filter: "drop-shadow(0 18px 26px rgba(249, 115, 22, 0.22))" }}
      >
        <svg width="100" height="100" viewBox="0 0 120 120" fill="none">
          <defs>
            <linearGradient id="ring-orange-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffedd5" />
              <stop offset="35%" stopColor="#fdba74" />
              <stop offset="70%" stopColor="#fb923c" />
              <stop offset="100%" stopColor="#ea580c" />
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

      {/* 4. Anneau / Torus Bleu Pastel (Milieu Gauche) */}
      <div
        className="floating-shape-4 absolute left-[3%] top-[42%]"
        style={{ filter: "drop-shadow(0 16px 24px rgba(37, 99, 235, 0.18))" }}
      >
        <svg width="95" height="95" viewBox="0 0 120 120" fill="none">
          <defs>
            <linearGradient id="ring-blue-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#dbeafe" />
              <stop offset="50%" stopColor="#93c5fd" />
              <stop offset="100%" stopColor="#3b82f6" />
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

      {/* 5. Sphère Violet Pastel (Centre Droite) */}
      <div
        className="floating-shape-5 absolute right-[10%] top-[56%]"
        style={{ filter: "drop-shadow(0 20px 28px rgba(124, 58, 237, 0.22))" }}
      >
        <svg width="105" height="105" viewBox="0 0 100 100" fill="none">
          <defs>
            <radialGradient id="sphere-violet-grad" cx="32%" cy="30%" r="68%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="25%" stopColor="#ede9fe" />
              <stop offset="65%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#7c3aed" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="46" fill="url(#sphere-violet-grad)" />
        </svg>
      </div>

      {/* 6. Cube Isométrique Orange Pastel (Bas Gauche) */}
      <div
        className="floating-shape-6 absolute left-[6%] top-[66%]"
        style={{ filter: "drop-shadow(0 16px 22px rgba(234, 88, 12, 0.20))" }}
      >
        <svg width="78" height="78" viewBox="0 0 100 100" fill="none">
          <defs>
            <linearGradient id="cube-orange-top" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fff7ed" />
              <stop offset="100%" stopColor="#fed7aa" />
            </linearGradient>
            <linearGradient id="cube-orange-left" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fdba74" />
              <stop offset="100%" stopColor="#fb923c" />
            </linearGradient>
            <linearGradient id="cube-orange-right" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#c2410c" />
            </linearGradient>
          </defs>
          <polygon points="50,15 85,32 50,49 15,32" fill="url(#cube-orange-top)" />
          <polygon points="15,32 50,49 50,85 15,68" fill="url(#cube-orange-left)" />
          <polygon points="50,49 85,32 85,68 50,85" fill="url(#cube-orange-right)" />
        </svg>
      </div>

      {/* 7. Sphère Bleu Ciel Pastel (Bas Droite) */}
      <div
        className="floating-shape-7 absolute right-[8%] top-[80%]"
        style={{ filter: "drop-shadow(0 14px 20px rgba(14, 165, 233, 0.20))" }}
      >
        <svg width="74" height="74" viewBox="0 0 100 100" fill="none">
          <defs>
            <radialGradient id="sphere-cyan-grad" cx="35%" cy="30%" r="65%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="30%" stopColor="#e0f2fe" />
              <stop offset="70%" stopColor="#7dd3fc" />
              <stop offset="100%" stopColor="#0284c7" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="46" fill="url(#sphere-cyan-grad)" />
        </svg>
      </div>

      {/* 8. Anneau / Torus Violet Pastel (Bas Gauche) */}
      <div
        className="floating-shape-8 absolute left-[9%] top-[88%]"
        style={{ filter: "drop-shadow(0 16px 24px rgba(147, 51, 234, 0.20))" }}
      >
        <svg width="88" height="88" viewBox="0 0 120 120" fill="none">
          <defs>
            <linearGradient id="ring-violet-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f3e8ff" />
              <stop offset="50%" stopColor="#d8b4fe" />
              <stop offset="100%" stopColor="#9333ea" />
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

      {/* 9. Sphère Orange Pastel (Haut-Milieu Gauche) */}
      <div
        className="floating-shape-9 absolute left-[12%] top-[24%]"
        style={{ filter: "drop-shadow(0 14px 22px rgba(249, 115, 22, 0.18))" }}
      >
        <svg width="78" height="78" viewBox="0 0 100 100" fill="none">
          <defs>
            <radialGradient id="sphere-orange-grad" cx="33%" cy="32%" r="67%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="28%" stopColor="#ffedd5" />
              <stop offset="70%" stopColor="#fb923c" />
              <stop offset="100%" stopColor="#ea580c" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="46" fill="url(#sphere-orange-grad)" />
        </svg>
      </div>
    </div>
  );
});
