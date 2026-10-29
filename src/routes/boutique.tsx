import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Store, Plus, Trash2, Pencil } from "lucide-react";
import { getShopOverview, saveShop, saveProduct, deleteProduct } from "@/lib/shop.functions";
import { presignAiUpload } from "@/lib/ai-tools.functions";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/boutique")({
  head: () => ({ meta: [{ title: "Créer ma boutique — Sam flash 2.0" }] }),
  component: BoutiquePage,
});

type Shop = { name: string; description: string; phone: string; address: string; logo_url: string | null };
type Product = { id: string; name: string; price: string; description: string; category: string; image_url: string | null };

const field = "w-full rounded-2xl border border-border bg-card p-3 text-sm outline-none";

/** Envoie une image vers notre stockage et renvoie son adresse publique. */
async function uploadImage(file: File, presign: (args: { data: { kind: "image"; type: string; size: number } }) => Promise<any>) {
  const res = await presign({ data: { kind: "image", type: file.type, size: file.size } });
  if (!res.ok) throw new Error(res.message ?? "Import impossible.");
  const put = await fetch(res.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!put.ok) throw new Error("Import impossible. Réessaie.");
  return res.publicUrl as string;
}

function BoutiquePage() {
  const load = useServerFn(getShopOverview);
  const saveShopFn = useServerFn(saveShop);
  const saveProductFn = useServerFn(saveProduct);
  const deleteFn = useServerFn(deleteProduct);
  const presign = useServerFn(presignAiUpload);

  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [shop, setShop] = useState<Shop>({ name: "", description: "", phone: "", address: "", logo_url: null });
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const res = await load();
      if (!res.ok) return setNeedsLogin(true);
      if (res.shop) setShop({ name: res.shop.name, description: res.shop.description, phone: res.shop.phone, address: res.shop.address, logo_url: res.shop.logo_url });
      setProducts(res.products as Product[]);
    } catch {
      setNeedsLogin(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitShop = async () => {
    setBusy(true);
    try {
      const res = await saveShopFn({ data: { name: shop.name, description: shop.description, phone: shop.phone, address: shop.address, logoUrl: shop.logo_url } });
      if (res.ok) toast.success("Boutique enregistrée.");
      else toast.error(res.message);
    } catch {
      toast.error("La boutique n'a pas pu être enregistrée.");
    } finally {
      setBusy(false);
    }
  };

  const onLogo = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setShop((s) => ({ ...s, logo_url: null }));
      const url = await uploadImage(file, presign as never);
      setShop((s) => ({ ...s, logo_url: url }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import impossible.");
    }
  };

  if (loading) return <main className="mx-auto max-w-md px-6 py-10 text-sm text-muted-foreground">Chargement…</main>;

  if (needsLogin)
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <Store className="h-8 w-8 text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Connecte-toi pour gérer ta boutique.</p>
        <Link to="/connexion" className="mt-6 text-sm font-semibold text-primary">Se connecter</Link>
      </main>
    );

  return (
    <main className="mx-auto max-w-md space-y-8 px-5 py-8 text-foreground">
      <header className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary"><Store className="h-6 w-6" /></div>
        <h1 className="text-xl font-bold">Ma boutique</h1>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Informations</h2>
        <div className="flex items-center gap-3">
          {shop.logo_url ? <img src={shop.logo_url} alt="Logo" className="h-16 w-16 rounded-2xl object-cover" /> : <div className="h-16 w-16 rounded-2xl bg-card" />}
          <label className="text-sm font-semibold text-primary">
            Logo
            <input type="file" accept="image/*" onChange={onLogo} className="hidden" />
          </label>
        </div>
        <input className={field} placeholder="Nom de la boutique" maxLength={120} value={shop.name} onChange={(e) => setShop({ ...shop, name: e.target.value })} />
        <textarea className={field} rows={3} placeholder="Description" maxLength={800} value={shop.description} onChange={(e) => setShop({ ...shop, description: e.target.value })} />
        <input className={field} placeholder="Téléphone" maxLength={40} value={shop.phone} onChange={(e) => setShop({ ...shop, phone: e.target.value })} />
        <input className={field} placeholder="Adresse" maxLength={200} value={shop.address} onChange={(e) => setShop({ ...shop, address: e.target.value })} />
        <button type="button" disabled={busy} onClick={() => void submitShop()} className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">
          Enregistrer la boutique
        </button>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Mes produits ({products.length})</h2>
          <button type="button" onClick={() => setEditing("new")} className="flex items-center gap-1 text-sm font-semibold text-primary"><Plus className="h-4 w-4" /> Ajouter</button>
        </div>
        {products.length === 0 && <p className="text-sm text-muted-foreground">Aucun produit pour l'instant.</p>}
        {products.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-card p-3">
            {p.image_url ? <img src={p.image_url} alt={p.name} className="h-14 w-14 rounded-xl object-cover" /> : <div className="h-14 w-14 rounded-xl bg-background" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{p.name}</p>
              <p className="truncate text-xs text-muted-foreground">{p.price || "Prix non renseigné"}</p>
            </div>
            <button type="button" aria-label="Modifier" onClick={() => setEditing(p)} className="p-2 text-muted-foreground"><Pencil className="h-4 w-4" /></button>
            <button
              type="button"
              aria-label="Supprimer"
              onClick={async () => {
                const res = await deleteFn({ data: { id: p.id } });
                if (res.ok) setProducts((list) => list.filter((x) => x.id !== p.id));
                else toast.error(res.message);
              }}
              className="p-2 text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </section>

      {editing && (
        <ProductForm
          initial={editing === "new" ? null : editing}
          presign={presign as never}
          onCancel={() => setEditing(null)}
          onSaved={(p) => {
            setProducts((list) => (list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [p, ...list]));
            setEditing(null);
          }}
          save={(data) => saveProductFn({ data })}
        />
      )}

      <Link to="/vendeur" className="block text-center text-sm font-semibold text-primary">← Retour à Créative AI</Link>
    </main>
  );
}

function ProductForm({
  initial,
  presign,
  onCancel,
  onSaved,
  save,
}: {
  initial: Product | null;
  presign: (args: { data: { kind: "image"; type: string; size: number } }) => Promise<any>;
  onCancel: () => void;
  onSaved: (p: Product) => void;
  save: (data: { id?: string; name: string; price: string; description: string; category: string; imageUrl: string | null }) => Promise<any>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(initial?.price ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.image_url ?? null);
  const [busy, setBusy] = useState(false);

  const onImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setImageUrl(await uploadImage(file, presign));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import impossible.");
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const res = await save({ id: initial?.id, name, price, description, category, imageUrl });
      if (res.ok) {
        toast.success("Produit enregistré.");
        onSaved(res.product as Product);
      } else toast.error(res.message);
    } catch {
      toast.error("Le produit n'a pas pu être enregistré.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end bg-black/60" role="dialog" aria-label="Produit">
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-background p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold">{initial ? "Modifier le produit" : "Nouveau produit"}</p>
          <button type="button" onClick={onCancel} className="text-sm text-muted-foreground">Fermer</button>
        </div>
        {imageUrl ? <img src={imageUrl} alt="Produit" className="max-h-48 w-full rounded-2xl object-contain" /> : null}
        <label className="block text-sm font-semibold text-primary">
          {imageUrl ? "Changer la photo" : "Ajouter une photo"}
          <input type="file" accept="image/*" onChange={onImage} className="hidden" />
        </label>
        <input className={field} placeholder="Nom du produit" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        <input className={field} placeholder="Prix (ex. 15 000 FC)" maxLength={60} value={price} onChange={(e) => setPrice(e.target.value)} />
        <input className={field} placeholder="Catégorie" maxLength={80} value={category} onChange={(e) => setCategory(e.target.value)} />
        <textarea className={field} rows={3} placeholder="Description" maxLength={800} value={description} onChange={(e) => setDescription(e.target.value)} />
        <button type="button" disabled={busy} onClick={() => void submit()} className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">
          {busy ? "Enregistrement…" : "Enregistrer le produit"}
        </button>
      </div>
    </div>
  );
}
