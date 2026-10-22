import { useEffect, useState } from "react";

const COMMUNITY_URL = "https://whatsapp.com/channel/0029Vb7lO7oIHphA3svFxK3e";
const STORAGE_KEY = "sf_community_invite_dismissed";

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
      /* stockage indisponible : on ferme quand même pour cette session */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="mx-auto mt-6 w-[calc(100%-2rem)] max-w-xl rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-2xl transition-all duration-700 ease-out">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-xl">
          🔔
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Rejoignez la communauté Sam Flash 2.0</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Soyez averti en premier des nouveautés, des mises à jour et des opportunités : offres, astuces et nouvelles
            fonctionnalités.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href={COMMUNITY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full bg-emerald-500 px-5 py-2.5 text-xs font-semibold text-white shadow-[0_10px_30px_-10px] shadow-emerald-500/60 transition-all duration-500 ease-out hover:-translate-y-0.5 active:scale-[0.98]"
            >
              Rejoindre sur WhatsApp
            </a>
            <button
              type="button"
              onClick={dismiss}
              className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
            >
              Plus tard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
