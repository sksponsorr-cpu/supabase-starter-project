/**
 * Bouton rond affiché quand une génération échoue.
 * Au clic, l'utilisateur est redirigé vers la page « Signaler un problème » (/signaler).
 */
import { MessageCircle, X } from "lucide-react";

export function SupportWhatsAppButton({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-24 right-4 z-[120] flex items-center gap-2">
      <div className="max-w-[190px] rounded-2xl rounded-br-sm bg-[#141426] px-3 py-2 text-xs text-white shadow-lg">
        T'as un souci ? Contacte-nous ici.
      </div>
      <button
        type="button"
        onClick={() => window.location.assign("/signaler")}
        aria-label="Signaler un problème"
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-black shadow-lg transition-transform active:scale-95"
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366]/60" aria-hidden />
        <MessageCircle className="relative h-6 w-6" />
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fermer"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
