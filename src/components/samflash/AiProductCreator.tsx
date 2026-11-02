import { useState, type ChangeEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { draftProductFromPhoto, draftProductFromLink } from "@/lib/shop.ai.functions";
import { presignAiUpload } from "@/lib/ai-tools.functions";
import { saveProduct } from "@/lib/shop.functions";
import { toast } from "@/lib/toast";

type Draft = { name: string; category: string; description: string; imageUrl: string | null };

/** Crée un produit avec l'IA : photo ou lien, puis le vendeur ajoute le prix et valide. */
export function AiProductCreator({ onSaved }: { onSaved: () => void }) {
  const fromPhoto = useServerFn(draftProductFromPhoto);
  const fromLink = useServerFn(draftProductFromLink);
  const presign = useServerFn(presignAiUpload);
  const save = useServerFn(saveProduct);

  const [mode, setMode] = useState<"photo" | "lien">("photo");
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [price, setPrice] = useState("");

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Lecture impossible."));
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(",")[1];
      // La photo est aussi envoyée sur la boutique pour servir d'image au produit.
      const up = await presign({ data: { kind: "image", type: file.type, size: file.size } });
      if (!up.ok) throw new Error(up.message ?? "Import impossible.");
      await fetch(up.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      const r = await fromPhoto({ data: { mimeType: file.type as "image/jpeg", data: base64, imageUrl: up.publicUrl as string } });
      if (!r.ok || !r.draft) throw new Error(r.message ?? "L'IA n'a pas pu lire ce produit.");
      setDraft(r.draft);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  };

  const onLink = async () => {
    setBusy(true);
    try {
      const r = await fromLink({ data: { url } });
      if (!r.ok || !r.draft) throw new Error(r.message ?? "L'IA n'a pas pu lire ce lien.");
      setDraft(r.draft);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    if (!draft) return;
    if (!price.trim()) return toast.error("Indiquez le prix du produit.");
    setBusy(true);
    try {
      await save({ data: { name: draft.name, category: draft.category, description: draft.description, price: price.trim(), imageUrl: draft.imageUrl } });
      toast.success("Produit ajouté à votre boutique.");
      setDraft(null);
      setPrice("");
      setUrl("");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 p-4">
      <div>
        <h2 className="text-sm font-semibold">Créer un produit avec l'IA</h2>
        <p className="text-xs text-muted-foreground">Ajoutez une photo, ou collez le lien d'un produit d'une autre plateforme. L'IA rédige le reste.</p>
      </div>

      <div className="flex gap-2">
        {(["photo", "lien"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`rounded-full px-3 py-1 text-sm ${mode === m ? "bg-white text-black" : "border border-white/15"}`}>
            {m === "photo" ? "Depuis une photo" : "Depuis un lien"}
          </button>
        ))}
      </div>

      {!draft && mode === "photo" && <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhoto} disabled={busy} className="text-sm" />}
      {!draft && mode === "lien" && (
        <div className="flex gap-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="flex-1 rounded-xl bg-background/60 p-2 text-sm" />
          <button onClick={onLink} disabled={busy || url.length < 8} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? "Analyse…" : "Analyser"}
          </button>
        </div>
      )}

      {draft && (
        <div className="space-y-3">
          {draft.imageUrl && <img src={draft.imageUrl} alt="" className="h-40 w-40 rounded-xl object-cover" />}
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="w-full rounded-xl bg-background/60 p-2" />
          <input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="Catégorie" className="w-full rounded-xl bg-background/60 p-2" />
          <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={4} className="w-full rounded-xl bg-background/60 p-2" />
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Prix (ex. 15 000 GNF)" className="w-full rounded-xl bg-background/60 p-2" />
          <div className="flex gap-2">
            <button onClick={onSave} disabled={busy} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              Ajouter à ma boutique
            </button>
            <button onClick={() => setDraft(null)} className="rounded-full border border-white/15 px-4 py-2 text-sm">Recommencer</button>
          </div>
        </div>
      )}
    </section>
  );
}
