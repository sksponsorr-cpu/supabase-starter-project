import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getGenerationAccess } from "@/lib/device.functions";
import { ResourcesPanel } from "@/components/samflash/ResourcesPanel";

export const Route = createFileRoute("/ressources")({
  head: () => ({
    meta: [
      { title: "Ressources — Sam flash 2.0" },
      { name: "description", content: "Formations, prompts vidéo, niches virales et actualités pour créer des vidéos IA qui marchent." },
    ],
  }),
  component: RessourcesPage,
});

function RessourcesPage() {
  const getAccess = useServerFn(getGenerationAccess);
  const navigate = useNavigate();
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    getAccess({ data: { mediaType: "image", seconds: 0 } })
      .then((r) => setPlan((r as { planType?: string }).planType ?? "free"))
      .catch(() => setPlan("free"));
  }, [getAccess]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Ressources</h1>
      <ResourcesPanel planType={plan} onSeeOffers={() => navigate({ to: "/boutique" })} />
    </main>
  );
}
