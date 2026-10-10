import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Code2, Copy, Menu, MessageSquare, Paperclip, Plus, Send, Trash2, X } from "lucide-react";
import { sendChat, aiAccess, CHAT_MODELS } from "@/lib/chat.functions";
import { toast } from "@/lib/toast";

type Provider = "claude" | "gpt";
type Mode = "chat" | "code";

export const Route = createFileRoute("/chat-ia")({
  validateSearch: (search: Record<string, unknown>): { p: Provider } => ({
    p: search.p === "gpt" ? "gpt" : "claude",
  }),
  head: () => ({ meta: [{ title: "Chat IA — Sam flash 2.0" }] }),
  component: ChatPage,
});

type Msg = { role: "user" | "assistant"; content: string; apiContent?: string; note?: string };
type Chat = { id: string; provider: Provider; title: string; model: string; mode: Mode; messages: Msg[]; updatedAt: number };
type Attachment =
  | { kind: "image"; name: string; mediaType: "image/jpeg"; data: string; preview: string }
  | { kind: "text"; name: string; text: string };

const STORAGE_KEY = "sf_ai_chats_v1";
const TEXT_EXT = /\.(txt|md|json|csv|js|ts|tsx|jsx|py|html|css|sql|php|java|c|cpp|go|rs|sh|yml|yaml|xml|log)$/i;
const MAX_TOTAL_CHARS = 55000;

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const newChat = (provider: Provider, model: string, mode: Mode): Chat => ({
  id: newId(),
  provider,
  title: "Nouvelle conversation",
  model,
  mode,
  messages: [],
  updatedAt: Date.now(),
});

/** Réduit une image (1280 px max, JPEG) pour rester léger à l'envoi. */
async function toAttachment(file: File): Promise<Attachment | null> {
  if (file.type.startsWith("image/")) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    return { kind: "image", name: file.name, mediaType: "image/jpeg", data: dataUrl.split(",")[1], preview: dataUrl };
  }
  if (file.type.startsWith("text/") || TEXT_EXT.test(file.name)) {
    const text = (await file.text()).slice(0, 40000);
    return { kind: "text", name: file.name, text };
  }
  return null;
}

/** Affiche le texte avec des blocs de code et un bouton Copier. */
function MessageContent({ text }: { text: string }) {
  const parts = text.split(/```/);
  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (i % 2 === 0) {
          return part.trim() ? (
            <p key={i} className="whitespace-pre-wrap break-words">
              {part.trim()}
            </p>
          ) : null;
        }
        const code = part.replace(/^[a-zA-Z0-9+#-]*\n/, "");
        return <CodeBlock key={i} code={code.replace(/\n$/, "")} />;
      })}
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-black/40">
      <div className="flex justify-end border-b border-border px-2 py-1">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(code).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ChatPage() {
  const { p } = Route.useSearch();
  const provider: Provider = p;
  const models = CHAT_MODELS[provider];
  const title = provider === "gpt" ? "ChatGPT" : "Claude AI";

  const send = useServerFn(sendChat);
  const checkAccess = useServerFn(aiAccess);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [allChats, setAllChats] = useState<Chat[]>([]);
  const [current, setCurrent] = useState<Chat>(() => newChat(provider, models[0].id, "chat"));
  const [drawer, setDrawer] = useState(false);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAccess({})
      .then((r) => setEnabled(r.enabled))
      .catch(() => setEnabled(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Historique local (stocké sur cet appareil).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setAllChats(JSON.parse(raw) as Chat[]);
    } catch {
      setAllChats([]);
    }
  }, []);

  const persist = (chats: Chat[]) => {
    setAllChats(chats);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0, 40)));
    } catch {
      // espace de stockage plein : on ignore
    }
  };

  // Nouvelle conversation quand on change d'outil (Claude / ChatGPT).
  useEffect(() => {
    setCurrent(newChat(provider, CHAT_MODELS[provider][0].id, "chat"));
    setAttachments([]);
  }, [provider]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [current.messages.length, busy]);

  const save = (chat: Chat) => {
    const rest = allChats.filter((c) => c.id !== chat.id);
    persist([{ ...chat, updatedAt: Date.now() }, ...rest]);
  };

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        const att = await toAttachment(file);
        if (!att) {
          toast.error("Ce type de fichier n'est pas pris en charge (images, texte et code).");
          continue;
        }
        setAttachments((prev) => {
          if (att.kind === "image" && prev.filter((a) => a.kind === "image").length >= 4) {
            toast.error("4 images maximum par message.");
            return prev;
          }
          return [...prev, att];
        });
      } catch {
        toast.error("Impossible de lire ce fichier.");
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || busy) return;

    const images = attachments.filter((a): a is Extract<Attachment, { kind: "image" }> => a.kind === "image");
    const textFiles = attachments.filter((a): a is Extract<Attachment, { kind: "text" }> => a.kind === "text");

    let apiContent = text;
    for (const f of textFiles) apiContent += `\n\n[Fichier : ${f.name}]\n\`\`\`\n${f.text}\n\`\`\``;
    if (!apiContent.trim()) apiContent = "Voici une image.";
    if (apiContent.length > MAX_TOTAL_CHARS) {
      toast.error("Message trop long. Réduisez le texte ou les fichiers joints.");
      return;
    }

    const note = [
      images.length ? `${images.length} image${images.length > 1 ? "s" : ""}` : "",
      ...textFiles.map((f) => f.name),
    ]
      .filter(Boolean)
      .join(" · ");

    const userMsg: Msg = { role: "user", content: text || "Voici une image.", apiContent, note: note || undefined };
    const next: Chat = {
      ...current,
      title: current.messages.length === 0 ? (text || note || "Conversation").slice(0, 40) : current.title,
      messages: [...current.messages, userMsg],
    };
    setCurrent(next);
    setInput("");
    const sentAttachments = attachments;
    setAttachments([]);
    setBusy(true);

    try {
      const res = await send({
        data: {
          provider,
          model: next.model,
          mode: next.mode,
          messages: next.messages.map((m, i) => ({
            role: m.role,
            content: m.apiContent ?? m.content,
            images:
              i === next.messages.length - 1 && images.length > 0
                ? images.map((img) => ({ mediaType: img.mediaType, data: img.data }))
                : undefined,
          })),
        },
      });
      if (res.ok) {
        const done: Chat = { ...next, messages: [...next.messages, { role: "assistant", content: res.text }] };
        setCurrent(done);
        save(done);
      } else {
        toast.error(res.message);
        setCurrent(current);
        setInput(text);
        setAttachments(sentAttachments);
      }
    } catch {
      toast.error("Envoi impossible. Vérifiez votre connexion et réessayez.");
      setCurrent(current);
      setInput(text);
      setAttachments(sentAttachments);
    } finally {
      setBusy(false);
    }
  };

  const startNew = () => {
    setCurrent(newChat(provider, current.model, current.mode));
    setAttachments([]);
    setInput("");
    setDrawer(false);
  };

  const openChat = (chat: Chat) => {
    setCurrent(chat);
    setDrawer(false);
  };

  const removeChat = (id: string) => {
    persist(allChats.filter((c) => c.id !== id));
    if (current.id === id) setCurrent(newChat(provider, current.model, current.mode));
  };

  const mine = allChats.filter((c) => c.provider === provider);

  if (enabled === false) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <h1 className="text-xl font-semibold">{title} arrive bientôt</h1>
        <p className="text-sm text-muted-foreground">Cette fonctionnalité est en cours de préparation.</p>
        <Link to="/outils-ai" className="rounded-full bg-secondary px-5 py-2 text-sm">
          Retour aux outils
        </Link>
      </main>
    );
  }

  return (
    <main className="flex h-[100dvh] flex-col bg-background text-foreground">
      {/* En-tête */}
      <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <button
          type="button"
          aria-label="Ouvrir le menu"
          onClick={() => setDrawer(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">{title}</h1>
        {current.mode === "code" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
            <Code2 className="h-3.5 w-3.5" /> Code
          </span>
        )}
        <select
          value={current.model}
          onChange={(e) => setCurrent({ ...current, model: e.target.value })}
          className="ml-auto max-w-[45%] rounded-xl border border-border bg-background px-3 py-1.5 text-sm"
          aria-label="Choisir le modèle"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </header>

      {/* Messages */}
      <section className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {current.messages.length === 0 && (
          <div className="pt-16 text-center">
            <p className="text-lg font-medium">Comment puis-je vous aider ?</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Posez une question, joignez une image ou un fichier avec le trombone.
            </p>
          </div>
        )}
        {current.messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-card/60"
              }`}
            >
              {m.role === "assistant" ? <MessageContent text={m.content} /> : <p className="whitespace-pre-wrap break-words">{m.content}</p>}
              {m.note && <p className="mt-1 text-xs opacity-80">📎 {m.note}</p>}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-border bg-card/60 px-4 py-2.5 text-sm text-muted-foreground">
              Réponse en cours…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </section>

      {/* Zone de saisie */}
      <footer className="border-t border-border bg-background px-3 pb-3 pt-2">
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <div key={i} className="relative flex items-center gap-2 rounded-xl border border-border bg-card/60 p-1.5 pr-8">
                {a.kind === "image" ? (
                  <img src={a.preview} alt={a.name} className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-xs">TXT</span>
                )}
                <span className="max-w-[110px] truncate text-xs">{a.name}</span>
                <button
                  type="button"
                  aria-label="Retirer"
                  onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute right-1.5 top-1.5 text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex items-end gap-2"
        >
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,.txt,.md,.json,.csv,.js,.ts,.tsx,.jsx,.py,.html,.css,.sql,.php,.java,.c,.cpp,.go,.rs,.sh,.yml,.yaml,.xml,.log"
            className="hidden"
            onChange={(e) => void addFiles(e.target.files)}
          />
          <button
            type="button"
            aria-label="Joindre un fichier"
            onClick={() => fileRef.current?.click()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={1}
            maxLength={20000}
            placeholder="Écrivez votre message"
            className="max-h-32 flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-[15px]"
          />
          <button
            type="submit"
            disabled={busy || (!input.trim() && attachments.length === 0)}
            aria-label="Envoyer"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </footer>

      {/* Menu latéral */}
      {drawer && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex h-full w-[84%] max-w-sm flex-col border-r border-border bg-background p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">{title}</h2>
              <button type="button" aria-label="Fermer" onClick={() => setDrawer(false)} className="p-2">
                <X className="h-5 w-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={startNew}
              className="mt-4 flex items-center gap-2 rounded-2xl bg-foreground px-4 py-3 text-sm font-semibold text-background"
            >
              <Plus className="h-4 w-4" /> Nouvelle conversation
            </button>

            <button
              type="button"
              onClick={() => setCurrent({ ...current, mode: current.mode === "code" ? "chat" : "code" })}
              className={`mt-3 flex items-center gap-3 rounded-2xl border px-4 py-3 text-left ${
                current.mode === "code" ? "border-primary bg-primary/10" : "border-border"
              }`}
            >
              <Code2 className="h-5 w-5" />
              <span className="flex-1">
                <span className="block text-sm font-medium">Mode Code</span>
                <span className="block text-xs text-muted-foreground">
                  {current.mode === "code" ? "Activé : réponses orientées programmation" : "Assistant de programmation"}
                </span>
              </span>
            </button>

            <p className="mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Récents</p>
            <ul className="mt-2 flex-1 space-y-1 overflow-y-auto">
              {mine.length === 0 && <li className="px-2 py-2 text-sm text-muted-foreground">Aucune conversation.</li>}
              {mine.map((c) => (
                <li key={c.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openChat(c)}
                    className={`flex flex-1 items-center gap-2 truncate rounded-xl px-3 py-2.5 text-left text-sm ${
                      current.id === c.id ? "bg-secondary" : ""
                    }`}
                  >
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    <span className="truncate">{c.title}</span>
                  </button>
                  <button type="button" aria-label="Supprimer" onClick={() => removeChat(c.id)} className="p-2 text-muted-foreground">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>

            <Link to="/outils-ai" className="mt-3 flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
              <ArrowLeft className="h-4 w-4" /> Plus outils AI
            </Link>
          </div>
          <button type="button" aria-label="Fermer le menu" onClick={() => setDrawer(false)} className="flex-1 bg-black/50" />
        </div>
      )}
    </main>
  );
}
