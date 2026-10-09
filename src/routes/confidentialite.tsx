import { createFileRoute } from "@tanstack/react-router";
import { LegalView, PRIVACY } from "@/components/samflash/legal";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — Sam flash 2.0" },
      {
        name: "description",
        content: "Politique de confidentialité de Sam flash 2.0 : données collectées et vos droits.",
      },
    ],
  }),
  component: () => <LegalView doc={PRIVACY} />,
});
