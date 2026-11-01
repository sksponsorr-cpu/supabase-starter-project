import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PlansSheet } from "@/components/samflash/PlansSheet";

/**
 * Page publique des abonnements : https://www.sam-flash.lat/abonnements
 * Une offre ouverte a son lien : https://www.sam-flash.lat/abonnements?plan=pro
 */
export const Route = createFileRoute("/abonnements")({
  validateSearch: (search: Record<string, unknown>): { plan?: string } => ({
    plan: typeof search.plan === "string" ? search.plan : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Abonnements — Sam flash" },
      { name: "description", content: "Offres Sam flash : compte gratuit, Light, Pro et Sur mesure. Veo 3.1, Grok Imagine et Seedance." },
    ],
  }),
  component: AbonnementsPage,
});

function AbonnementsPage() {
  const { plan } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <PlansSheet
      key={plan ?? "offres"}
      initialPlan={plan}
      onClose={() => navigate({ to: plan ? "/abonnements" : "/app", search: {} })}
    />
  );
}
