import { createFileRoute } from "@tanstack/react-router";
import { LegalView, TERMS } from "@/components/samflash/legal";

export const Route = createFileRoute("/conditions")({
  head: () => ({
    meta: [
      { title: "Conditions générales d'utilisation — Sam flash 2.0" },
      { name: "description", content: "Conditions générales d'utilisation de Sam flash 2.0." },
    ],
  }),
  component: () => (
    <main className="mx-auto min-h-screen max-w-2xl px-5 pb-10 text-foreground">
      <a href="/" className="inline-block pt-6 text-sm text-muted-foreground underline">← Accueil</a>
      <LegalView doc={TERMS} />
    </main>
  ),
});
