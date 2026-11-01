import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PlansSheet } from "@/components/samflash/PlansSheet";

/** Page dédiée d'une offre : /abonnements/light, /abonnements/pro, /abonnements/custom */
export const Route = createFileRoute("/abonnements/$plan")({
  head: ({ params }) => ({
    meta: [{ title: `Abonnement ${params.plan} — Sam flash` }],
  }),
  component: PlanPage,
});

function PlanPage() {
  const { plan } = Route.useParams();
  const navigate = useNavigate();
  return <PlansSheet initialPlan={plan} detailOnly onClose={() => navigate({ to: "/abonnements" })} />;
}
