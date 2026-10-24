import { createFileRoute, Link } from "@tanstack/react-router";
import { Store } from "lucide-react";

export const Route = createFileRoute("/boutique")({
  head: () => ({ meta: [{ title: "Créer ma boutique — Sam flash 2.0" }] }),
  component: BoutiquePage,
});

function BoutiquePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Store className="h-8 w-8" />
      </div>
      <h1 className="mt-6 text-2xl font-bold text-foreground">Créer ma boutique</h1>
      <p className="mt-3 text-sm text-muted-foreground">Bientôt disponible.</p>
      <Link to="/app" className="mt-8 text-sm font-semibold text-primary">
        ← Retour au studio
      </Link>
    </main>
  );
}
