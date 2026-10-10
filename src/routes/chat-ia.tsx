import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Send } from "lucide-react";
import { sendChat, aiAccess, CHAT_MODELS } from "@/lib/chat.functions";
import { toast } from "@/lib/toast";

type Provider = "claude" | "gpt";

export const Route = createFileRoute("/chat-ia")({
  validateSearch: (search: Record<string, unknown>): { p: Provider } => ({
    p: search.p === "gpt" ? "gpt" : "claude",
  }),
  head: () => ({
    meta: [{ title: "Chat IA — Sam flash 2.0" }],
  }),
  component: ChatPage,
});

type Message = { role: "user" | "assistant"; content: string };

function ChatPage() {
  const { p } = Route.useSearch();
  const provider: Provider = p;
  const models = CHAT_MODELS[provider];
  const [model, setModel] = useState<string>(models[0].id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const send = useServerFn(sendChat);
  const checkAccess = useServerFn(aiAccess);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    checkAccess({})
      .then((r) => setEnabled(r.enabled))
      .catch(() => setEnabled(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const title = provider === "gpt" ? "ChatGPT" : "Claude AI";

  const submit = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await send({ data: { provider, model, messages: next } });
      if (res.ok) {
        setMessages([...next, { role: "assistant", content: res.text }]);
      } else {
        toast.error(res.message);
        setMessages(messages);
        setInput(text);
      }
    } catch {
      toast.error("Envoi impossible, réessayez.");
      setMessages(messages);
      setInput(text);
    } finally {
      setBusy(false);
    }
  };

  if (enabled === false) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <h1 className="text-xl font-semibold">{title} arrive bientôt</h1>
        <p className="text-sm text-muted-foreground">Cette fonctionnalité est en cours de test.</p>
        <Link to="/outils-ai" className="rounded-full bg-secondary px-5 py-2 text-sm">Retour aux outils</Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <Link to="/outils-ai" className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-semibold">{title}</h1>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="ml-auto rounded-xl border border-border bg-background px-3 py-1.5 text-sm"
          aria-label="Choisir le modèle"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </header>

      <section className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="pt-10 text-center text-sm text-muted-foreground">
            Posez votre question. Chaque réponse est débitée de vos crédits selon son coût réel.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
              m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-card/60 border border-border"
            }`}
          >
            {m.content}
          </div>
        ))}
        {busy && <p className="text-sm text-muted-foreground">Réponse en cours…</p>}
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="sticky bottom-0 flex gap-2 border-t border-border bg-background px-4 py-3"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={1}
          maxLength={8000}
          placeholder="Écrivez votre message"
          className="flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-[15px]"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Envoyer"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </main>
  );
}
