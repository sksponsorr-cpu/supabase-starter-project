import { createFileRoute } from "@tanstack/react-router";
import { SellerStudio } from "@/components/samflash/SellerStudio";
import { SellerSidebar } from "@/components/samflash/SellerSidebar";

export const Route = createFileRoute("/vendeur")({
  head: () => ({ meta: [{ title: "Espace vendeur — Sam flash 2.0" }] }),
  component: VendeurPage,
});

/** Espace vendeur : menu et paramètres propres, séparés de l'espace créateur. */
function VendeurPage() {

  return (
    <div className="flex min-h-screen">
      <SellerSidebar />
      <main className="flex-1 min-w-0 pb-16">
        <header className="flex items-center justify-between px-4 pb-4 pt-4">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">Espace vendeur</span>
        </header>
        <div className="mx-auto max-w-2xl px-4 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Qu'allons-nous vendre aujourd'hui ?</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choisis le type de publicité : les choix s'adaptent à ton produit.</p>
        </div>
        <SellerStudio />
      </main>
    </div>
  );
}
