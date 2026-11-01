import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ResourcesFeed } from "@/components/samflash/ResourcesFeed";
import { MemberPublishForm } from "@/components/samflash/MemberPublishForm";
import { useState } from "react";

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
  const [publishing, setPublishing] = useState(false);
  const [reload, setReload] = useState(0);
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ressources</h1>
        <button onClick={() => setPublishing(!publishing)} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          {publishing ? "Fermer" : "Publier"}
        </button>
      </div>
      {publishing && (
        <div className="mb-6">
          <MemberPublishForm onDone={() => { setReload((n) => n + 1); }} />
        </div>
      )}
      <ResourcesFeed key={reload} onSeeOffers={() => navigate({ to: "/abonnements" })} />
    </main>
  );
}
