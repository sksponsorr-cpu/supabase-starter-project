import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ToolLogo } from "@/components/samflash/ToolLogo";
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

type ToolId = "claude" | "chatgpt" | "clonage-video" | "avatar-ai";

type Tool = {
  id: ToolId;
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
    price: "Débit selon l'usage réel",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    logo: "/tools/chatgpt.png",
    description: "Discussion et programmation assistée avec les modèles GPT.",
    price: "Débit selon l'usage réel",
  },
  {
    id: "clonage-video",
    name: "Clonage vidéo",
    logo: "/tools/clonage-video.png",
    description: "Donnez les mouvements d'une vidéo à un autre personnage.",
    price: "À partir de 0,9 crédit / seconde",
  },
  {
    id: "avatar-ai",
    name: "Avatar AI",
    logo: "/tools/avatar-ai.png",
    description: "Créez un avatar qui parle à partir d'une photo et d'une voix.",
    price: "À partir de 0,65 crédit / seconde",
  },
];

/** Lien vers la bonne page selon l'outil. */
function OpenLink({ id, className, children }: { id: ToolId; className?: string; children: React.ReactNode }) {
  if (id === "claude") {
    return (
      <Link to="/chat-ia" search={{ p: "claude" }} className={className}>
        {children}
      </Link>
    );
  }
  if (id === "chatgpt") {
    return (
      <Link to="/chat-ia" search={{ p: "gpt" }} className={className}>
        {children}
      </Link>
    );
  }
  if (id === "clonage-video") {
    return (
      <Link to="/clonage-video" className={className}>
        {children}
      </Link>
    );
  }
  return (
    <Link to="/avatar-ai" className={className}>
      {children}
    </Link>
  );
}

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
            const body = (
              <>
                <div className="flex h-36 items-center justify-center bg-zinc-100">
                  <ToolLogo src={tool.logo} name={tool.name} className="h-28 w-28" />
                </div>
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <h2 className="text-lg font-semibold">{tool.name}</h2>
                  <p className="text-sm leading-relaxed text-zinc-600">{tool.description}</p>
                  <div className="mt-auto flex items-center justify-between pt-4">
                    <span className="text-xs font-medium text-zinc-500">{tool.price}</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium ${
                        enabled ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-500"
                      }`}
                    >
                      {enabled ? "Ouvrir" : "Bientôt"} <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </>
            );
            return (
              <article key={tool.id} className="flex flex-col overflow-hidden rounded-3xl bg-white text-zinc-900 shadow-sm">
                {enabled ? (
                  <OpenLink id={tool.id} className="flex flex-1 flex-col">
                    {body}
                  </OpenLink>
                ) : (
                  <div className="flex flex-1 flex-col opacity-90">{body}</div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
