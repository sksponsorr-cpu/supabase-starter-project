import { createFileRoute, Link } from "@tanstack/react-router";
import { SellerStudio } from "@/components/samflash/SellerStudio";

export const Route = createFileRoute("/vendeur")({
  head: () => ({ meta: [{ title: "Espace vendeur — Sam flash 2.0" }] }),
  component: VendeurPage,
});

function VendeurPage() {
  return (
    <main className="min-h-screen pb-16 pt-[max(env(safe-area-inset-top),16px)]">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 pb-4">
        <Link to="/app" className="text-sm text-muted-foreground">← Mode créateur</Link>
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">Espace vendeur</span>
      </div>
      <div className="mx-auto max-w-2xl px-4 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Qu'allons-nous vendre aujourd'hui ?</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choisis le type de publicité : les choix s'adaptent à ton produit.</p>
      </div>
      <SellerStudio />
    </main>
  );
}
