import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicShop } from "@/lib/shop.public.functions";

type Shop = NonNullable<Awaited<ReturnType<typeof getPublicShop>>>;

/** WhatsApp n'accepte que les chiffres, avec l'indicatif pays. */
const digits = (phone: string) => phone.replace(/\D/g, "");

export function ShopPublic({ id }: { id: string }) {
  const fetchShop = useServerFn(getPublicShop);
  const [shop, setShop] = useState<Shop | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void fetchShop({ data: { id } }).then((s) => setShop(s));
  }, [id]);

  if (shop === undefined) return <p className="p-8 text-center text-sm text-muted-foreground">Chargement…</p>;
  if (shop === null) return <p className="p-8 text-center text-sm text-muted-foreground">Cette boutique n'existe pas.</p>;

  const link = typeof window !== "undefined" ? window.location.href : "";
  const wa = digits(shop.phone);

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title: shop.name, url: link }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <header className="flex flex-col items-center text-center">
        {shop.logoUrl ? (
          <img src={shop.logoUrl} alt={shop.name} className="h-24 w-24 rounded-3xl object-cover shadow-lg" />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/20 text-3xl font-bold">
            {shop.name.charAt(0).toUpperCase()}
          </div>
        )}
        <h1 className="mt-4 text-2xl font-bold">{shop.name}</h1>
        {shop.address && <p className="mt-1 text-sm text-muted-foreground">{shop.address}</p>}
        {shop.description && <p className="mt-3 max-w-xl text-sm leading-relaxed">{shop.description}</p>}
        <button onClick={share} className="mt-4 rounded-full border border-white/15 px-4 py-2 text-sm">
          {copied ? "Lien copié" : "Partager la boutique"}
        </button>
      </header>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">Articles ({shop.products.length})</h2>
        {shop.products.length === 0 && <p className="text-sm text-muted-foreground">Aucun article pour le moment.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {shop.products.map((p) => (
            <article key={p.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} className="aspect-square w-full object-cover" />
              ) : (
                <div className="aspect-square w-full bg-white/5" />
              )}
              <div className="space-y-2 p-4">
                {p.category && <p className="text-xs uppercase tracking-wide text-muted-foreground">{p.category}</p>}
                <h3 className="font-semibold">{p.name}</h3>
                {p.price && <p className="font-bold text-primary">{p.price}</p>}
                {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
                {wa && (
                  <a
                    href={`https://wa.me/${wa}?text=${encodeURIComponent(`Bonjour, je suis intéressé par « ${p.name} » sur ${shop.name}.`)}`}
                    target="_blank"
                    rel="noopener"
                    className="mt-2 inline-block rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    Commander sur WhatsApp
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {wa && (
        <div className="fixed inset-x-0 bottom-0 flex gap-3 border-t border-white/10 bg-background/90 p-3 backdrop-blur">
          <a href={`tel:+${wa}`} className="flex-1 rounded-full border border-white/15 py-3 text-center text-sm font-semibold">
            Appeler
          </a>
          <a
            href={`https://wa.me/${wa}?text=${encodeURIComponent(`Bonjour, je vous contacte depuis ${shop.name}.`)}`}
            target="_blank"
            rel="noopener"
            className="flex-1 rounded-full bg-primary py-3 text-center text-sm font-semibold text-primary-foreground"
          >
            Contacter sur WhatsApp
          </a>
        </div>
      )}
    </main>
  );
}
