import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Phone, ShieldCheck, Truck, Clock, Share2, ArrowLeft, ChevronDown } from "lucide-react";
import { getPublicShop } from "@/lib/shop.public.functions";

type Shop = NonNullable<Awaited<ReturnType<typeof getPublicShop>>>;
type Product = Shop["products"][number];

const digits = (phone: string) => phone.replace(/\D/g, "");

const STYLE = `
@keyframes sfRise { from { opacity: 0; transform: translateY(18px); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes sfFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes sfShine { from { background-position: -200% 0; } to { background-position: 200% 0; } }
.sf-rise { animation: sfRise .7s cubic-bezier(.2,.7,.2,1) both; }
.sf-float { animation: sfFloat 6s ease-in-out infinite; }
.sf-card { transition: transform .35s ease, box-shadow .35s ease; }
.sf-card:hover { transform: translateY(-4px); box-shadow: 0 18px 40px -18px rgba(15,23,42,.35); }
.sf-shine { background: linear-gradient(110deg, transparent 35%, rgba(255,255,255,.35) 50%, transparent 65%) ; background-size: 200% 100%; animation: sfShine 3.5s linear infinite; }
`;

function categoriesOf(products: Product[]) {
  const map = new Map<string, Product[]>();
  for (const p of products) {
    const key = p.category || "Nos articles";
    map.set(key, [...(map.get(key) ?? []), p]);
  }
  return [...map.entries()].map(([label, items]) => ({ label, count: items.length, image: items.find((i) => i.imageUrl)?.imageUrl ?? null }));
}

export function ShopPublic({ id, produit }: { id: string; produit?: string }) {
  const fetchShop = useServerFn(getPublicShop);
  const [shop, setShop] = useState<Shop | null | undefined>(undefined);
  const [filter, setFilter] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void fetchShop({ data: { id } }).then((s) => setShop(s));
  }, [id]);

  const cats = useMemo(() => (shop ? categoriesOf(shop.products) : []), [shop]);

  if (shop === undefined) return <p className="p-8 text-center text-sm text-slate-500">Chargement…</p>;
  if (shop === null) return <p className="p-8 text-center text-sm text-slate-500">Cette boutique n'existe pas.</p>;

  const wa = digits(shop.phone);
  const waLink = (text: string) => `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;
  const hero = shop.products.find((p) => p.imageUrl)?.imageUrl ?? shop.logoUrl ?? null;
  const list = filter ? shop.products.filter((p) => (p.category || "Nos articles") === filter) : shop.products;
  const item = produit ? shop.products.find((p) => p.id === produit) : undefined;

  const share = async () => {
    const link = window.location.href;
    if (navigator.share) await navigator.share({ title: shop.name, url: link }).catch(() => undefined);
    else {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const Header = (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/60 bg-white/80 px-4 py-3 backdrop-blur-xl">
      <a href={`/magasin?id=${id}`} className="flex items-center gap-2">
        {shop.logoUrl ? <img src={shop.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-sm font-bold text-white">{shop.name.charAt(0)}</span>}
        <span className="font-bold tracking-tight">{shop.name}</span>
      </a>
      <button onClick={share} className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold">
        <Share2 className="h-3.5 w-3.5" />
        {copied ? "Lien copié" : "Partager"}
      </button>
    </header>
  );

  // Fiche produit
  if (produit && item) {
    return (
      <div className="min-h-screen bg-white pb-28 text-slate-900">
        <style>{STYLE}</style>
        {Header}
        <main className="mx-auto max-w-5xl px-4 pb-10 pt-4 md:grid md:grid-cols-2 md:gap-10 md:px-6 md:pt-10">
          <div className="sf-rise relative aspect-square w-full overflow-hidden rounded-3xl bg-slate-100 shadow-xl">
            {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />}
          </div>
          <div className="sf-rise mt-6 space-y-5 md:mt-0" style={{ animationDelay: "120ms" }}>
            <a href={`/magasin?id=${id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700"><ArrowLeft className="h-4 w-4" /> Retour à la boutique</a>
            {item.category && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{item.category}</p>}
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight">{item.name}</h1>
            {item.price && <p className="text-3xl font-black text-blue-700">{item.price}</p>}
            {wa && (
              <a href={waLink(`Bonjour, je veux commander « ${item.name} » sur ${shop.name}.`)} target="_blank" rel="noopener" className="sf-shine flex items-center justify-center gap-2 rounded-full bg-blue-700 py-4 text-sm font-bold text-white shadow-lg shadow-blue-700/30">
                <MessageCircle className="h-4 w-4" /> Commander sur WhatsApp
              </a>
            )}
            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="rounded-2xl bg-slate-50 p-3"><Truck className="mx-auto mb-1 h-4 w-4 text-blue-700" />Livraison confirmée</div>
              <div className="rounded-2xl bg-slate-50 p-3"><ShieldCheck className="mx-auto mb-1 h-4 w-4 text-blue-700" />Achat sécurisé</div>
              <div className="rounded-2xl bg-slate-50 p-3"><Clock className="mx-auto mb-1 h-4 w-4 text-blue-700" />Réponse rapide</div>
            </div>
            <section>
              <h2 className="mb-2 text-sm font-bold">Description</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{item.description || "Contactez le vendeur pour en savoir plus sur ce produit."}</p>
            </section>
          </div>
        </main>
        {wa && (
          <div className="fixed inset-x-0 bottom-0 z-40 flex gap-3 border-t border-slate-200 bg-white/90 p-3 backdrop-blur-xl">
            <a href={`tel:+${wa}`} className="flex flex-1 items-center justify-center gap-2 rounded-full border border-slate-300 py-3 text-sm font-semibold"><Phone className="h-4 w-4" />Appeler</a>
            <a href={waLink(`Bonjour, je veux commander « ${item.name} ».`)} target="_blank" rel="noopener" className="flex flex-1 items-center justify-center gap-2 rounded-full bg-blue-700 py-3 text-sm font-bold text-white"><MessageCircle className="h-4 w-4" />Commander</a>
          </div>
        )}
      </div>
    );
  }

  // Boutique
  return (
    <div className="min-h-screen bg-white pb-28 text-slate-900">
      <style>{STYLE}</style>
      {Header}

      {/* Accueil : fond flouté d'un produit, logo qui flotte */}
      <section className="relative isolate overflow-hidden px-6 py-16 text-center text-white">
        <div className="absolute inset-0 -z-10">
          {hero && <img src={hero} alt="" className="h-full w-full scale-125 object-cover blur-2xl" />}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-900/60 to-slate-900/90" />
        </div>
        <div className="sf-rise mx-auto flex max-w-2xl flex-col items-center">
          {shop.logoUrl ? (
            <img src={shop.logoUrl} alt={shop.name} className="sf-float h-24 w-24 rounded-3xl object-cover shadow-2xl ring-4 ring-white/20" />
          ) : (
            <div className="sf-float flex h-24 w-24 items-center justify-center rounded-3xl bg-white/15 text-3xl font-black ring-4 ring-white/20">{shop.name.charAt(0)}</div>
          )}
          <h1 className="mt-6 text-4xl font-black tracking-tight md:text-5xl">{shop.name}</h1>
          {shop.description && <p className="mt-4 max-w-xl text-base leading-relaxed text-white/85">{shop.description}</p>}
          {shop.address && <p className="mt-2 text-xs text-white/70">{shop.address}</p>}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#articles" className="rounded-full bg-white px-7 py-3.5 text-sm font-bold text-slate-900 shadow-xl">Découvrir les articles</a>
            {wa && (
              <a href={waLink(`Bonjour, je vous contacte depuis ${shop.name}.`)} target="_blank" rel="noopener" className="flex items-center justify-center gap-2 rounded-full border border-white/30 px-7 py-3.5 text-sm font-semibold backdrop-blur">
                <MessageCircle className="h-4 w-4" /> Nous écrire
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Réassurance */}
      <section className="mx-auto grid max-w-4xl grid-cols-1 gap-3 px-4 py-8 sm:grid-cols-3">
        {[
          [MessageCircle, "Commande par WhatsApp", "Un message suffit pour commander"],
          [ShieldCheck, "Vendeur joignable", "Une question ? Réponse directe"],
          [Truck, "Livraison confirmée", "Délais et frais précisés avant envoi"],
        ].map(([Icon, title, text], i) => {
          const I = Icon as typeof MessageCircle;
          return (
            <div key={i} className="sf-rise rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" style={{ animationDelay: `${i * 90}ms` }}>
              <I className="mb-2 h-5 w-5 text-blue-700" />
              <p className="text-sm font-bold">{title as string}</p>
              <p className="text-xs text-slate-500">{text as string}</p>
            </div>
          );
        })}
      </section>

      {/* Comment commander */}
      <section className="mx-auto max-w-4xl px-4 py-6">
        <h2 className="text-center text-2xl font-black tracking-tight">Commander en 3 étapes</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {["Choisissez votre article", "Écrivez-nous sur WhatsApp", "Confirmez la livraison"].map((t, i) => (
            <div key={t} className="rounded-2xl bg-slate-50 p-5 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-700 text-sm font-black text-white">{i + 1}</div>
              <p className="text-sm font-bold">{t}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Catégories */}
      {cats.length > 0 && (
        <section className="px-4 pt-6">
          <div className="mx-auto mb-4 flex max-w-4xl items-center justify-between">
            <h2 className="text-xl font-black tracking-tight">Catégories</h2>
            {filter && <button onClick={() => setFilter(null)} className="text-sm font-semibold text-blue-700">Voir tout</button>}
          </div>
          <div className="mx-auto flex max-w-4xl gap-3 overflow-x-auto pb-2">
            {cats.map((c) => (
              <button key={c.label} onClick={() => setFilter(c.label)} className={`sf-card group relative h-40 w-44 shrink-0 overflow-hidden rounded-2xl bg-slate-200 text-left ${filter === c.label ? "ring-2 ring-blue-700" : ""}`}>
                {c.image && <img src={c.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3">
                  <p className="text-sm font-bold text-white">{c.label}</p>
                  <p className="text-xs text-white/75">{c.count} article(s)</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Articles */}
      <section id="articles" className="mx-auto max-w-4xl px-4 pt-10">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="text-2xl font-black tracking-tight">{filter ?? "Nos produits"}</h2>
          <span className="text-sm text-slate-500">{list.length} produit(s)</span>
        </div>
        {list.length === 0 && <p className="py-10 text-center text-sm text-slate-500">Aucun article pour le moment.</p>}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {list.map((p, i) => (
            <article key={p.id} className="sf-rise sf-card overflow-hidden rounded-2xl border border-slate-100 bg-white" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
              <a href={`/magasin?id=${id}&produit=${p.id}`} className="group block aspect-square overflow-hidden bg-slate-100">
                {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />}
              </a>
              <div className="space-y-1.5 p-3">
                {p.category && <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{p.category}</p>}
                <a href={`/magasin?id=${id}&produit=${p.id}`}><h3 className="line-clamp-2 text-sm font-bold leading-snug">{p.name}</h3></a>
                {p.price && <p className="text-base font-black text-blue-700">{p.price}</p>}
                {wa && (
                  <a href={waLink(`Bonjour, je suis intéressé par « ${p.name} » sur ${shop.name}.`)} target="_blank" rel="noopener" className="mt-2 flex items-center justify-center gap-1.5 rounded-full bg-blue-700 py-2 text-xs font-bold text-white">
                    <MessageCircle className="h-3.5 w-3.5" /> Commander
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="text-center text-2xl font-black tracking-tight">Questions fréquentes</h2>
        <div className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200">
          {[
            ["Comment passer commande ?", "Cliquez sur « Commander » à côté de l'article : un message WhatsApp s'ouvre avec le nom du produit déjà rempli. Envoyez-le, le vendeur vous répond."],
            ["Comment payer ?", "Le mode de paiement est convenu directement avec le vendeur sur WhatsApp, avant la livraison."],
            ["Quels sont les délais et les frais de livraison ?", "Le vendeur vous les confirme par WhatsApp avant l'envoi de votre commande."],
            ["Puis-je poser une question avant d'acheter ?", "Oui. Utilisez le bouton « Nous écrire » ou « Appeler » : le vendeur répond directement."],
          ].map(([q, a]) => (
            <details key={q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold">
                {q}
                <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Coordonnées */}
      <footer className="border-t border-slate-200 bg-slate-950 px-6 py-12 text-center text-white">
        <p className="text-lg font-black">{shop.name}</p>
        {shop.address && <p className="mt-2 text-sm text-white/70">{shop.address}</p>}
        {shop.phone && <p className="mt-1 text-sm text-white/70">{shop.phone}</p>}
        {wa && (
          <a href={waLink(`Bonjour, je vous contacte depuis ${shop.name}.`)} target="_blank" rel="noopener" className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-900">
            <MessageCircle className="h-4 w-4" /> Écrire sur WhatsApp
          </a>
        )}
      </footer>

      {wa && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex gap-3 border-t border-slate-200 bg-white/90 p-3 backdrop-blur-xl">
          <a href={`tel:+${wa}`} className="flex flex-1 items-center justify-center gap-2 rounded-full border border-slate-300 py-3 text-sm font-semibold"><Phone className="h-4 w-4" />Appeler</a>
          <a href={waLink(`Bonjour, je vous contacte depuis ${shop.name}.`)} target="_blank" rel="noopener" className="flex flex-1 items-center justify-center gap-2 rounded-full bg-blue-700 py-3 text-sm font-bold text-white"><MessageCircle className="h-4 w-4" />WhatsApp</a>
        </div>
      )}
    </div>
  );
}
