import { createFileRoute } from "@tanstack/react-router";
import { McpKeysPanel } from "@/components/samflash/McpKeysPanel";

export const Route = createFileRoute("/connecter")({
  head: () => ({ meta: [{ title: "Connecter Sam Flash — Sam flash 2.0" }] }),
  component: ConnecterPage,
});

function ConnecterPage() {
  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-5 py-10 text-foreground">
      <a href="/app" className="text-sm text-muted-foreground">← Retour</a>
      <h1 className="mt-4 text-2xl font-bold">Connecter Sam Flash</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Crée une clé, puis colle l'adresse dans les connecteurs de Claude ou ChatGPT.
      </p>
      <div className="mt-6">
        <McpKeysPanel />
      </div>
    </main>
  );
}
