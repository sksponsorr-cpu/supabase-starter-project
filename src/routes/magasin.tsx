import { createFileRoute } from "@tanstack/react-router";
import { ShopPublic } from "@/components/samflash/ShopPublic";

/** Boutique publique à partager : https://www.sam-flash.lat/magasin?id=... */
export const Route = createFileRoute("/magasin")({
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
  head: () => ({ meta: [{ title: "Boutique — Sam flash" }] }),
  component: MagasinPage,
});

function MagasinPage() {
  const { id } = Route.useSearch();
  if (!id) return <p className="p-8 text-center text-sm text-muted-foreground">Lien de boutique incomplet.</p>;
  return <ShopPublic id={id} />;
}
