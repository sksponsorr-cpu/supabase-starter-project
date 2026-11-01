import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ResourcesFeed } from "@/components/samflash/ResourcesFeed";

export const Route = createFileRoute("/ressources")({
  head: () => ({
    meta: [
      { title: "Ressources — Sam flash" },
      { name: "description", content: "Formations, prompts détaillés, niches virales et actualités pour créer des vidéos IA qui marchent." },
    ],
  }),
  component: RessourcesPage,
});

function RessourcesPage() {
  const navigate = useNavigate();
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Ressources</h1>
      <ResourcesFeed onSeeOffers={() => navigate({ to: "/abonnements" })} />
    </main>
  );
}
