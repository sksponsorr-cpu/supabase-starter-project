import { useState, type ChangeEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { saveProduct, deleteProduct } from "@/lib/shop.functions";
import { presignAiUpload } from "@/lib/ai-tools.functions";
import { CATEGORIES, field, uploadImage } from "./shared";

export type SellerProduct = {
  id: string;
  name: string;
  price: string;
  description: string;
  category: string;
  image_url: string | null;
  stock: number;
  is_active: boolean;
};

type Draft = Omit<SellerProduct, "image_url"> & { imageUrl: string | null };
const EMPTY: Draft = { id: "", name: "", price: "", description: "", category: "", stock: 0, is_active: true, imageUrl: null };

export function SellerProducts({ products, onChanged }: { products: SellerProduct[]; onChanged: () => void }) {
  const save = useServerFn(saveProduct);
  const remove = useServerFn(deleteProduct);
  const presign = useServerFn(presignAiUpload);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = (p?: SellerProduct) =>
    setEditing(p ? { ...p, imageUrl: p.image_url } : { ...EMPTY });

  const onImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    try {
      setEditing({ ...editing, imageUrl: await uploadImage(file, presign) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import impossible.");
    }
  };

  const submit = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const r = await save({
        data: {
          id: editing.id || undefined,
          name: editing.name,
          price: editing.price,
          description: editing.description,
          category: editing.category,
          stock: Number(editing.stock) || 0,
          isActive: editing.is_active,
          imageUrl: editing.imageUrl,
        },
      });
      if (!r.ok) throw new Error(r.message);
      setEditing(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Produit non enregistré.");
    } finally {
      setBusy(false);
    }
  };

  const destroy = async (id: string) => {
    if (!window.confirm("Supprimer ce produit ?")) return;
    await remove({ data: { id } });
    onChanged();
  };

  const toggle = async (p: SellerProduct) => {
    await save({
      data: { id: p.id, name: p.name, price: p.price, description: p.description, category: p.category, stock: p.stock, isActive: !p.is_active, imageUrl: p.image_url },
    });
    onChanged();
  };

  const adjustStock = async (p: SellerProduct, delta: number) => {
    const next = Math.max(0, p.stock + delta);
    await save({
      data: { id: p.id, name: p.name, price: p.price, description: p.description, category: p.category, stock: next, isActive: p.is_active, imageUrl: p.image_url },
    });
    onChanged();
  };

  if (editing) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-black text-slate-900">{editing.id ? "Modifier le produit" : "Nouveau produit"}</h2>
        <input className={field} placeholder="Nom du produit" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <input className={field} placeholder="Prix (ex : 15 000 FCFA)" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} />
          <input className={field} type="number" min={0} placeholder="Stock" value={editing.stock} onChange={(e) => setEditing({ ...editing, stock: Math.max(0, Number(e.target.value) || 0) })} />
        </div>
        <select className={field} value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
          <option value="">Catégorie du produit</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <textarea className={field} rows={3} placeholder="Description" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
          Visible dans ma boutique
        </label>
        <div className="flex items-center gap-3">
          {editing.imageUrl && <img src={editing.imageUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" />}
          <input type="file" accept="image/*" onChange={onImage} className="text-sm" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(null)} className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-600">Annuler</button>
          <button type="button" disabled={busy || editing.name.trim().length < 2} onClick={submit} className="rounded-full bg-blue-700 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-40">
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-900">Mes produits</h2>
        <button type="button" onClick={() => open()} className="rounded-full bg-blue-700 px-5 py-2 text-sm font-bold text-white">+ Ajouter</button>
      </div>
      {products.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Aucun produit pour l'instant.</p>}
      <ul className="divide-y divide-slate-100 rounded-3xl border border-slate-200 bg-white">
        {products.map((p) => (
          <li key={p.id} className="flex items-center gap-4 p-4">
            {p.image_url ? <img src={p.image_url} alt="" className="h-14 w-14 rounded-2xl object-cover" /> : <span className="h-14 w-14 rounded-2xl bg-slate-100" />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-900">{p.name}</p>
              <p className="text-xs text-slate-500">{p.price || "Prix non renseigné"} · {p.category || "Sans catégorie"}</p>
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.stock === 0 ? "bg-red-50 text-red-700" : p.stock <= 3 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                {p.stock === 0 ? "Rupture de stock" : `${p.stock} en stock`}{!p.is_active ? " · masqué" : ""}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1 text-xs">
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => adjustStock(p, -1)} className="h-7 w-7 rounded-full border border-slate-200">−</button>
                <button type="button" onClick={() => adjustStock(p, 1)} className="h-7 w-7 rounded-full border border-slate-200">+</button>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => open(p)} className="font-semibold text-blue-700">Modifier</button>
                <button type="button" onClick={() => toggle(p)} className="font-semibold text-slate-500">{p.is_active ? "Masquer" : "Afficher"}</button>
                <button type="button" onClick={() => destroy(p.id)} className="font-semibold text-red-600">Supprimer</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
