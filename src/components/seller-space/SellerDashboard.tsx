import { useState } from "react";
import { Share2 } from "lucide-react";
import { SellerProducts, type SellerProduct } from "./SellerProducts";
import { SellerOrders } from "./SellerOrders";
import { shopLink } from "./shared";

type Shop = { user_id: string; name: string; category: string; country: string; description: string };
type Tab = "apercu" | "produits" | "commandes" | "lien";

const TABS: { key: Tab; label: string }[] = [
  { key: "apercu", label: "Aperçu" },
  { key: "produits", label: "Produits" },
  { key: "commandes", label: "Commandes" },
  { key: "lien", label: "Mon lien" },
];

/** Espace vendeur une fois la boutique créée. */
export function SellerDashboard({
  shop,
  products,
  onChanged,
}: {
  shop: Shop;
  products: SellerProduct[];
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<Tab>("apercu");
  const [copied, setCopied] = useState(false);
  const link = shopLink(shop.user_id);

  const share = async () => {
    if (navigator.share) await navigator.share({ title: shop.name, url: link }).catch(() => undefined);
    else {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const lowStock = products.filter((p) => p.is_active && p.stock <= 3);
  const outOfStock = products.filter((p) => p.stock === 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Espace vendeur</p>
          <h1 className="text-2xl font-black text-slate-900">{shop.name}</h1>
          <p className="text-sm text-slate-500">{shop.category || "Sans catégorie"}{shop.country ? ` · ${shop.country}` : ""}</p>
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto rounded-full bg-slate-100 p-1">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${tab === t.key ? "bg-white text-slate-900 shadow" : "text-slate-500"}`}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "apercu" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Produits" value={products.length} />
            <Stat label="En rupture" value={outOfStock.length} tone={outOfStock.length ? "warn" : undefined} />
            <Stat label="Stock faible" value={lowStock.length} tone={lowStock.length ? "warn" : undefined} />
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <h2 className="font-bold text-slate-900">Ton lien de boutique</h2>
            <p className="mt-1 text-sm text-slate-500">Partage-le : tes clients voient tes produits, créent un compte et commandent.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-700">{link}</code>
              <button type="button" onClick={share} className="inline-flex items-center gap-1.5 rounded-full bg-blue-700 px-4 py-2 text-sm font-bold text-white">
                <Share2 className="h-4 w-4" /> {copied ? "Lien copié" : "Partager"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "produits" && <SellerProducts products={products} onChanged={onChanged} />}
      {tab === "commandes" && <SellerOrders userId={shop.user_id} />}
      {tab === "lien" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="font-bold text-slate-900">Aperçu de ta boutique</h2>
          <p className="mt-1 text-sm text-slate-500">C'est ce que voient tes clients quand ils ouvrent ton lien.</p>
          <a href={link} target="_blank" rel="noopener" className="mt-4 inline-block rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-800">
            Ouvrir ma boutique
          </a>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-black ${tone === "warn" ? "text-amber-600" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
