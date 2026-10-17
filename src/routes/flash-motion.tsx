import { createFileRoute, redirect } from "@tanstack/react-router";

// Motion AI est retiré : l'ancienne adresse renvoie vers la liste des outils.
export const Route = createFileRoute("/flash-motion")({
  beforeLoad: () => {
    throw redirect({ to: "/outils-ai" });
  },
});
