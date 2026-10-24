import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listSellerCardImages, adminSetSellerCardImage, SELLER_CARD_KEYS } from "@/lib/seller-card-images.functions";
import { toast } from "@/lib/toast";

const LABELS: Record<(typeof SELLER_CARD_KEYS)[number], string> = {
  "histoire-racontee": "Histoire racontée",
  ugc: "UGC",
  "pub-animee": "Pub animée",
  professionnel: "Professionnel",
  "avant-apres": "Avant / après",
  temoignage: "Témoignage",
  "publicite-produit": "Publicité produit",
  promotion: "Promotion",
};

/** Bureau administrateur de l'espace vendeur : une image par carte. */
export function AdminSellerCardsPanel() {
  const load = useServerFn(listSellerCardImages);
  const save = useServerFn(adminSetSellerCardImage);
  const [images, setImages] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => load({}).then(setImages).catch(() => setImages({}));
  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const onFile = (key: (typeof SELLER_CARD_KEYS)[number], file: File) => {
    if (file.size > 3 * 1024 * 1024) return toast("Image trop lourde (3 Mo maximum).");
    const reader = new FileReader();
    reader.onload = async () => {
      setBusy(key);
      try {
        const r = await save({ data: { styleKey: key, dataUrl: String(reader.result) } });
        toast(r.message);
        if (r.ok) await refresh();
      } catch {
        toast("Envoi impossible pour le moment.");
      } finally {
        setBusy(null);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-[22px] font-semibold tracking-tight">Espace vendeur : images des cartes</h2>
        <p className="mt-1 text-sm text-muted-foreground">Ajoute une image pour chaque style. PNG, JPG ou WebP, 3 Mo maximum.</p>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SELLER_CARD_KEYS.map((key) => (
          <li key={key} className="rounded-3xl border border-border/70 bg-card/50 p-4">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-muted">
                {images[key] ? <img src={images[key]} alt={LABELS[key]} className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{LABELS[key]}</p>
                <label className="mt-2 inline-flex cursor-pointer rounded-full bg-secondary px-3 py-1.5 text-xs font-medium">
                  {busy === key ? "Envoi…" : images[key] ? "Remplacer l'image" : "Ajouter une image"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={busy !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onFile(key, f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
