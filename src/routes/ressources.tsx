import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CommunityPage } from "@/components/samflash/CommunityPage";

export const Route = createFileRoute("/ressources")({
  head: () => ({
    meta: [
      { title: "Communauté — Sam flash" },
      { name: "description", content: "Formations, prompts, vidéos et membres de la communauté Sam flash." },
    ],
  }),
  component: RessourcesPage,
});

function RessourcesPage() {
  const navigate = useNavigate();
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <CommunityPage onSeeOffers={() => navigate({ to: "/abonnements" })} />
    </main>
  );
}
