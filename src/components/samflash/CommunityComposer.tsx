import { MemberPublishForm } from "@/components/samflash/MemberPublishForm";

/** Composeur de publication en plein écran, comme sur les réseaux sociaux. */
export function CommunityComposer({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#18191a]">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <button onClick={onClose} className="text-sm font-semibold text-muted-foreground">Annuler</button>
        <h2 className="text-base font-bold">Créer une publication</h2>
        <span className="w-16" />
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        <MemberPublishForm onDone={() => { onDone(); onClose(); }} />
      </div>
    </div>
  );
}
