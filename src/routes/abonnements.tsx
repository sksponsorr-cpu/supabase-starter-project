import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PlansSheet } from "@/components/samflash/PlansSheet";

/** Adresse publique des abonnements : https://www.sam-flash.lat/abonnements */
export const Route = createFileRoute("/abonnements")({
  head: () => ({
    meta: [
      { title: "Abonnements — Sam flash" },
      { name: "description", content: "Offres Sam flash : compte gratuit, Light, Pro et Sur mesure. Veo 3.1, Grok Imagine et Seedance." },
    ],
  }),
  component: AbonnementsPage,
});

function AbonnementsPage() {
  const navigate = useNavigate();
  return <PlansSheet onClose={() => navigate({ to: "/app" })} />;
}
