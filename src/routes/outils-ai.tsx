import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { ToolLogo } from "@/components/samflash/ToolLogo";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { aiAccess } from "@/lib/chat.functions";

export const Route = createFileRoute("/outils-ai")({
  head: () => ({
    meta: [
      { title: "Plus outils AI — Sam flash 2.0" },
      { name: "description", content: "Chat IA, programmation, clonage vidéo et avatars IA, avec un seul portefeuille de crédits." },
    ],
  }),
  component: ToolsPage,
});

type Tool = {
  id: string;
  name: string;
  logo: string;
  description: string;
  price: string;
};

const TOOLS: Tool[] = [
  {
    id: "claude",
    name: "Claude AI",
    logo: "/tools/claude.png",
    description: "Discutez avec les modèles Claude et programmez avec l'aide de l'IA.",
    price: "Prix en crédits à confirmer",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    logo: "/tools/chatgpt.png",
    description: "Discussion et programmation assistée avec les modèles GPT.",
    price: "Prix en crédits à confirmer",
  },
  {
    id: "clonage-video",
    name: "Clonage vidéo",
    logo: "/tools/clonage-video.png",
    description: "Reproduisez une vidéo avec un nouveau visage ou une nouvelle voix.",
    price: "Prix en crédits à confirmer",
  },
  {
    id: "avatar-ai",
    name: "Avatar AI",
    logo: "/tools/avatar-ai.png",
    description: "Créez un avatar IA à partir de vos photos.",
    price: "Prix en crédits à confirmer",
  },
];

function ToolsPage() {
  const checkAccess = useServerFn(aiAccess);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    checkAccess({})
      .then((r) => setEnabled(r.enabled))
      .catch(() => setEnabled(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-background px-5 pb-12 pt-6 text-foreground">
      <div className="mx-auto max-w-2xl">
        <Link to="/app" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour au studio
        </Link>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Plus outils AI</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Tous ces outils utilisent le même portefeuille de crédits que le reste de Sam flash.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {TOOLS.map((tool) => {
            // Test réservé à l'administrateur : les autres utilisateurs voient « Bientôt ».
            const href =
              enabled && tool.id === "claude"
                ? "/outils-ai/chat?p=claude"
                : enabled && tool.id === "chatgpt"
                  ? "/outils-ai/chat?p=gpt"
                  : null;
            return (
            <article
              key={tool.id}
              className="flex flex-col overflow-hidden rounded-3xl bg-white text-zinc-900 shadow-sm"
            >
              <div className="flex h-36 items-center justify-center bg-zinc-100">
                <ToolLogo src={tool.logo} name={tool.name} className="h-20 w-20" />
              </div>
              <div className="flex flex-1 flex-col gap-2 p-5">
                <h2 className="text-lg font-semibold">{tool.name}</h2>
                <p className="text-sm leading-relaxed text-zinc-600">{tool.description}</p>
                <div className="mt-auto flex items-center justify-between pt-4">
                  <span className="text-xs font-medium text-zinc-500">{tool.price}</span>
                  {href ? (
                    <Link
                      to={href}
                      className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
                    >
                      Ouvrir <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="inline-flex cursor-not-allowed items-center gap-1 rounded-full bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-500"
                    >
                      Bientôt <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </div>
              </div>
            </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
