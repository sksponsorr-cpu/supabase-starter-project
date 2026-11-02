import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { suggestDescription } from "@/lib/shop.ai.functions";
import { toast } from "@/lib/toast";

/** Propose une description à partir du nom et de la photo. Ne modifie jamais l'image du produit. */
export function SuggestDescriptionButton({
  name,
  category,
  imageUrl,
  onSuggested,
}: {
  name: string;
  category: string;
  imageUrl: string | null;
  onSuggested: (description: string) => void;
}) {
  const suggest = useServerFn(suggestDescription);
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (name.trim().length < 2) return toast.error("Indiquez d'abord le nom du produit.");
    setBusy(true);
    try {
      const r = await suggest({ data: { name, category, imageUrl } });
      if (!r.ok) throw new Error(r.message ?? "Suggestion impossible.");
      onSuggested(r.description);
      toast.success("Description proposée. Vérifiez-la avant d'enregistrer.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suggestion impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={onClick} disabled={busy} className="mt-2 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold disabled:opacity-50">
      {busy ? "Rédaction…" : "✨ Suggérer une description"}
    </button>
  );
}
