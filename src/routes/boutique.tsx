import { createFileRoute, redirect } from "@tanstack/react-router";

/** L'ancienne page boutique est remplacée par l'espace vendeur. */
export const Route = createFileRoute("/boutique")({
  beforeLoad: () => {
    throw redirect({ to: "/espace-vendeur" });
  },
});
