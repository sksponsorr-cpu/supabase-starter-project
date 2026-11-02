import { createFileRoute } from "@tanstack/react-router";
import { ShopPublic } from "@/components/samflash/ShopPublic";

/** Boutique publique : /magasin?id=... ; fiche d'un article : /magasin?id=...&produit=... */
export const Route = createFileRoute("/magasin")({
  validateSearch: (search: Record<string, unknown>): { id?: string; produit?: string } => ({
    id: typeof search.id === "string" ? search.id : undefined,
    produit: typeof search.produit === "string" ? search.produit : undefined,
  }),
  head: () => ({ meta: [{ title: "Boutique — Sam flash" }] }),
  component: MagasinPage,
});

function MagasinPage() {
  const { id, produit } = Route.useSearch();
  if (!id) return <p className="p-8 text-center text-sm text-muted-foreground">Lien de boutique incomplet.</p>;
  return <ShopPublic id={id} produit={produit} />;
}
