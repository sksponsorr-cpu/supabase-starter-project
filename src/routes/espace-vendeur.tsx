import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getShopOverview } from "@/lib/shop.functions";
import { SellerWizard } from "@/components/seller-space/SellerWizard";
import { SellerDashboard } from "@/components/seller-space/SellerDashboard";
import type { SellerProduct } from "@/components/seller-space/SellerProducts";

/**
 * Espace vendeur : site à part, indépendant de l'app des créateurs.
 * Sans boutique, l'assistant de création s'affiche. Avec une boutique, le tableau de bord.
 */
export const Route = createFileRoute("/espace-vendeur")({
  head: () => ({ meta: [{ title: "Espace vendeur — Sam flash" }] }),
  component: EspaceVendeurPage,
});

type Shop = { user_id: string; name: string; category: string; country: string; description: string };

function EspaceVendeurPage() {
  const load = useServerFn(getShopOverview);
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "login" }
    | { status: "ready"; shop: Shop | null; products: SellerProduct[] }
  >({ status: "loading" });

  const refresh = useCallback(async () => {
    try {
      const res = await load();
      if (!res.ok) return setState({ status: "login" });
      setState({
        status: "ready",
        shop: (res.shop as Shop | null) ?? null,
        products: (res.products as SellerProduct[]) ?? [],
      });
    } catch {
      setState({ status: "login" });
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (state.status === "loading") return <p className="p-8 text-center text-sm text-slate-500">Chargement…</p>;

  if (state.status === "login") {
    return (
      <div className="mx-auto max-w-sm space-y-4 p-8 text-center">
        <h1 className="text-xl font-black text-slate-900">Connecte-toi à ton espace vendeur</h1>
        <Link to="/connexion" className="inline-block rounded-full bg-blue-700 px-6 py-3 text-sm font-bold text-white">
          Me connecter
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      {state.shop ? (
        <SellerDashboard shop={state.shop} products={state.products} onChanged={refresh} />
      ) : (
        <SellerWizard onDone={refresh} />
      )}
    </div>
  );
}
