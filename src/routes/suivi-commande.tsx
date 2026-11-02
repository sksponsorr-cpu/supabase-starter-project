import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { OrderTracking } from "@/components/shop/OrderTracking";
import { CustomerAuth } from "@/components/shop/CustomerAuth";

/** Suivi de commande en temps réel, pour le client connecté. */
export const Route = createFileRoute("/suivi-commande")({
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
  head: () => ({ meta: [{ title: "Suivi de commande — Sam flash" }] }),
  component: SuiviCommandePage,
});

function SuiviCommandePage() {
  const { id } = Route.useSearch();
  const [logged, setLogged] = useState<boolean | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setLogged(Boolean(data.session)));
  }, []);

  if (!id) return <p className="p-8 text-center text-sm text-slate-500">Lien de suivi incomplet.</p>;
  if (logged === null) return <p className="p-8 text-center text-sm text-slate-500">Chargement…</p>;
  if (!logged) {
    return (
      <div className="mx-auto max-w-sm p-6">
        <CustomerAuth title="Connecte-toi pour suivre ta commande" onReady={() => setLogged(true)} />
        <p className="mt-4 text-center text-xs text-slate-500">
          Pas de compte ? <Link to="/connexion" className="font-semibold text-blue-700">En savoir plus</Link>
        </p>
      </div>
    );
  }
  return <OrderTracking orderId={id} />;
}
