import { useEffect, useState } from "react";

const COMMUNITY_URL = "https://whatsapp.com/channel/0029Vb7lO7oIHphA3svFxK3e";
const STORAGE_KEY = "sf_community_invite_dismissed";

const KEYFRAMES = `
@keyframes sf-invite-in {
  0% { opacity: 0; transform: translateY(18px) scale(0.96); filter: blur(10px); }
  60% { opacity: 1; filter: blur(0); }
  100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}
@keyframes sf-invite-bell {
  0%, 100% { transform: rotate(0deg); }
  15% { transform: rotate(14deg); }
  30% { transform: rotate(-12deg); }
  45% { transform: rotate(8deg); }
  60% { transform: rotate(-4deg); }
  75% { transform: rotate(0deg); }
}
@keyframes sf-invite-halo {
  0%, 100% { opacity: 0.35; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.12); }
}
@keyframes sf-invite-sheen {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(220%); }
}
@keyframes sf-invite-stagger {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.sf-invite-card { animation: sf-invite-in 900ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.sf-invite-bell { animation: sf-invite-bell 2.6s ease-in-out 0.6s infinite; transform-origin: 50% 20%; }
.sf-invite-halo { animation: sf-invite-halo 3.2s ease-in-out infinite; }
.sf-invite-sheen { animation: sf-invite-sheen 3.6s ease-in-out 1.2s infinite; }
.sf-invite-item { animation: sf-invite-stagger 700ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.sf-invite-item:nth-child(1) { animation-delay: 250ms; }
.sf-invite-item:nth-child(2) { animation-delay: 380ms; }
.sf-invite-item:nth-child(3) { animation-delay: 500ms; }
@media (prefers-reduced-motion: reduce) {
  .sf-invite-card, .sf-invite-bell, .sf-invite-halo, .sf-invite-sheen, .sf-invite-item { animation: none !important; }
}
`;

/**
 * Invitation à rejoindre la chaîne WhatsApp Sam Flash 2.0.
 * Affichée une seule fois : si l'utilisateur la ferme, elle ne revient plus.
 */
export function CommunityInvite() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* stockage indisponible : on ferme pour cette session */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="relative mx-auto mt-6 w-[calc(100%-2rem)] max-w-xl">
      <style>{KEYFRAMES}</style>

      {/* Halo lumineux en arrière-plan */}
      <div aria-hidden className="sf-invite-halo pointer-events-none absolute -inset-6 rounded-[40px] bg-emerald-500/25 blur-[60px]" />

      <div className="sf-invite-card relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.06] p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] backdrop-blur-3xl">
        {/* Reflet qui traverse la carte */}
        <div aria-hidden className="sf-invite-sheen pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="relative flex items-start gap-4">
          <div className="sf-invite-item relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400/30 to-emerald-600/10 ring-1 ring-emerald-400/30">
            <span className="sf-invite-bell text-2xl" aria-hidden>🔔</span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="sf-invite-item text-[15px] font-semibold tracking-tight">
              Rejoignez la communauté Sam Flash 2.0
            </p>
            <p className="sf-invite-item mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              Soyez averti en premier des nouveautés, des mises à jour et des opportunités : offres, astuces et nouvelles
              fonctionnalités.
            </p>

            <div className="sf-invite-item mt-5 flex flex-wrap items-center gap-4">
              <a
                href={COMMUNITY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_12px_32px_-12px] shadow-emerald-500/70 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:bg-emerald-400 hover:shadow-emerald-400/80 active:scale-[0.97]"
              >
                Rejoindre sur WhatsApp
                <span aria-hidden className="transition-transform duration-500 group-hover:translate-x-0.5">→</span>
              </a>
              <button
                type="button"
                onClick={dismiss}
                className="text-[13px] text-muted-foreground transition-colors duration-300 hover:text-foreground active:scale-[0.97]"
              >
                Plus tard
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={dismiss}
            aria-label="Fermer"
            className="sf-invite-item -mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all duration-300 hover:bg-white/10 hover:text-foreground active:scale-90"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
