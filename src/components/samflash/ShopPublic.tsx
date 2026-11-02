import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicShop } from "@/lib/shop.public.functions";

type Shop = NonNullable<Awaited<ReturnType<typeof getPublicShop>>>;
type Product = Shop["products"][number];

/** WhatsApp n'accepte que les chiffres, avec l'indicatif pays. */
const digits = (phone: string) => phone.replace(/\D/g, "");

/** Une vignette par catégorie, avec la première image trouvée dans cette catégorie. */
function categoriesOf(products: Product[]) {
  const map = new Map<string, Product[]>();
  for (const p of products) {
    const key = p.category || "Nos articles";
    map.set(key, [...(map.get(key) ?? []), p]);
  }
  return [...map.entries()].map(([label, items]) => ({ label, count: items.length, image: items.find((i) => i.imageUrl)?.imageUrl ?? null }));
}

export function ShopPublic({ id }: { id: string }) {
  const fetchShop = useServerFn(getPublicShop);
  const [shop, setShop] = useState<Shop | null | undefined>(undefined);
  const [filter, setFilter] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void fetchShop({ data: { id } }).then((s) => setShop(s));
  }, [id]);

  const cats = useMemo(() => (shop ? categoriesOf(shop.products) : []), [shop]);

  if (shop === undefined) return <p className="p-8 text-center text-sm text-muted-foreground">Chargement…</p>;
  if (shop === null) return <p className="p-8 text-center text-sm text-muted-foreground">Cette boutique n'existe pas.</p>;

  const wa = digits(shop.phone);
  const waLink = (text: string) => `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;
  const list = filter ? shop.products.filter((p) => (p.category || "Nos articles") === filter) : shop.products;

  const share = async () => {
    const link = window.location.href;
    if (navigator.share) await navigator.share({ title: shop.name, url: link }).catch(() => undefined);
    else {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-28 text-slate-900">
      {/* Bande d'accroche */}
      <div className="bg-blue-700 px-4 py-2 text-center text-xs font-medium text-white">
        Commande directe par WhatsApp · Réponse rapide
      </div>

      {/* En-tête */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          {shop.logoUrl ? (
            <img src={shop.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-sm font-bold text-white">{shop.name.charAt(0)}</div>
          )}
          <span className="font-bold">{shop.name}</span>
        </div>
        <button onClick={share} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold">
          {copied ? "Lien copié" : "Partager"}
        </button>
      </header>

      {/* Accueil */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 to-white px-6 py-12 text-center">
        {shop.logoUrl && <img src={shop.logoUrl} alt={shop.name} className="mx-auto h-24 w-24 rounded-3xl object-cover shadow-lg" />}
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight md:text-4xl">{shop.name}</h1>
        {shop.description && <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600">{shop.description}</p>}
        {shop.address && <p className="mt-2 text-xs text-slate-500">{shop.address}</p>}
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a href="#articles" className="w-64 rounded-full bg-blue-700 px-6 py-3 text-sm font-semibold text-white">
            Découvrir nos articles
          </a>
          {wa && (
            <a href={waLink(`Bonjour, je vous contacte depuis ${shop.name}.`)} target="_blank" rel="noopener" className="w-64 rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold">
              Nous contacter
            </a>
          )}
        </div>
      </section>

      {/* Réassurance */}
      <section className="grid grid-cols-3 gap-2 border-y border-slate-100 px-4 py-5 text-center text-xs">
        <div>
          <p className="font-bold">Contact direct</p>
          <p className="text-slate-500">Par WhatsApp</p>
        </div>
        <div>
          <p className="font-bold">Commande simple</p>
          <p className="text-slate-500">En un message</p>
        </div>
        <div>
          <p className="font-bold">Boutique officielle</p>
          <p className="text-slate-500">{shop.products.length} article(s)</p>
        </div>
      </section>

      {/* Catégories */}
      {cats.length > 0 && (
        <section className="px-4 pt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-extrabold">Nos catégories</h2>
            {filter && (
              <button onClick={() => setFilter(null)} className="text-sm font-semibold text-blue-700">
                Voir tout
              </button>
            )}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {cats.map((c) => (
              <button
                key={c.label}
                onClick={() => setFilter(c.label)}
                className={`relative h-36 w-40 shrink-0 overflow-hidden rounded-2xl bg-slate-100 text-left ${filter === c.label ? "ring-2 ring-blue-700" : ""}`}
              >
                {c.image && <img src={c.image} alt="" className="h-full w-full object-cover" />}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <p className="text-sm font-bold text-white">{c.label}</p>
                  <p className="text-xs text-white/80">{c.count} article(s)</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Articles */}
      <section id="articles" className="px-4 pt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-xl font-extrabold">{filter ?? "Nos produits"}</h2>
          <span className="text-sm text-slate-500">{list.length} produit(s)</span>
        </div>
        {list.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Aucun article pour le moment.</p>}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {list.map((p) => (
            <article key={p.id} className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
              <div className="aspect-square w-full bg-slate-100">
                {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />}
              </div>
              <div className="space-y-1.5 p-3">
                {p.category && <p className="text-[11px] uppercase tracking-wide text-slate-500">{p.category}</p>}
                <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</h3>
                {p.price && <p className="text-base font-extrabold text-blue-700">{p.price}</p>}
                {p.description && <p className="line-clamp-2 text-xs text-slate-500">{p.description}</p>}
                {wa && (
                  <a
                    href={waLink(`Bonjour, je suis intéressé par « ${p.name} » sur ${shop.name}.`)}
                    target="_blank"
                    rel="noopener"
                    className="mt-2 block rounded-full bg-blue-700 py-2 text-center text-xs font-semibold text-white"
                  >
                    Commander
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Coordonnées */}
      <footer className="mt-12 border-t border-slate-100 bg-slate-50 px-6 py-8 text-center text-sm">
        <p className="font-bold">{shop.name}</p>
        {shop.address && <p className="mt-1 text-slate-600">{shop.address}</p>}
        {shop.phone && <p className="mt-1 text-slate-600">{shop.phone}</p>}
      </footer>

      {/* Barre d'action fixe */}
      {wa && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex gap-3 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
          <a href={`tel:+${wa}`} className="flex-1 rounded-full border border-slate-300 py-3 text-center text-sm font-semibold">
            Appeler
          </a>
          <a href={waLink(`Bonjour, je vous contacte depuis ${shop.name}.`)} target="_blank" rel="noopener" className="flex-1 rounded-full bg-blue-700 py-3 text-center text-sm font-semibold text-white">
            WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}
