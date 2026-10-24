import { createFileRoute, Link } from "@tanstack/react-router";
import { TransferCredits } from "@/components/samflash/TransferCredits";
import { SellerSidebar } from "@/components/samflash/SellerSidebar";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/vendeur/parametres")({
  head: () => ({ meta: [{ title: "Paramètres vendeur — Sam flash 2.0" }] }),
  component: VendeurParametres,
});

/** Paramètres propres à l'espace vendeur : compte vendeur et crédits vendeur. */
function VendeurParametres() {
  const { user } = useAuth();
  return (
    <div className="flex min-h-screen">
      <SellerSidebar />
      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-16">
        <Link to="/vendeur" className="text-sm text-muted-foreground">← Espace vendeur</Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">Paramètres vendeur</h1>
        <section className="mt-6 space-y-4">
          <div className="rounded-3xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Compte vendeur</p>
            <p className="mt-2 text-sm text-foreground">{user?.email ?? "—"}</p>
          </div>
          <TransferCredits />
        </section>
      </main>
    </div>
  );
}
