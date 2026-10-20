import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createPortal } from "react-dom";
import { X, Check, Copy, Plug, KeyRound, MessageSquare, Sparkles } from "lucide-react";
import { listMcpKeys, createMcpKey, revokeMcpKey } from "@/lib/mcp/api-keys.functions";
import { toast } from "@/lib/toast";

type Key = { id: string; name: string; key_prefix: string; created_at: string; last_used_at: string | null; revoked_at: string | null };
type Provider = "claude" | "chatgpt";

const PROVIDERS: { id: Provider; label: string; hint: string; icon: typeof Sparkles; steps: string[] }[] = [
  {
    id: "claude",
    label: "Claude",
    hint: "Ajoute Sam Flash comme connecteur personnalisé.",
    icon: Sparkles,
    steps: [
      "Ouvre Claude, puis Paramètres.",
      "Va dans Connecteurs, puis « Ajouter un connecteur personnalisé ».",
      "Colle l'adresse complète copiée ci-dessus. Ne remplis aucun autre champ.",
      "Valide. Dans une conversation, demande une image ou une vidéo.",
    ],
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    hint: "Ajoute Sam Flash dans les connecteurs en mode développeur.",
    icon: MessageSquare,
    steps: [
      "Ouvre ChatGPT, puis Paramètres.",
      "Active le mode développeur, puis va dans Connecteurs.",
      "Colle l'adresse complète copiée ci-dessus.",
      "Valide. Dans une conversation, demande une image ou une vidéo.",
    ],
  },
];

/** Feuille « Connexion MCP » : création de clé, adresse complète, et mode d'emploi par assistant. */
export function McpConnectSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const list = useServerFn(listMcpKeys);
  const create = useServerFn(createMcpKey);
  const revoke = useServerFn(revokeMcpKey);
  const [keys, setKeys] = useState<Key[]>([]);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<Provider>("claude");
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== "undefined" ? `${window.location.origin}/api/public/mcp` : "/api/public/mcp";
  const fullUrl = fresh ? `${baseUrl}?key=${encodeURIComponent(fresh)}` : null;

  const refresh = () =>
    list().then((r) => setKeys(r.keys as Key[])).catch(() => toast.error("Impossible de charger tes clés."));

  useEffect(() => {
    if (open) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const onCreate = async () => {
    setBusy(true);
    try {
      const r = await create({ data: { name: name.trim() || "Assistant" } });
      setFresh(r.key);
      setName("");
      await refresh();
    } catch {
      toast.error("Impossible de créer la clé.");
    } finally {
      setBusy(false);
    }
  };

  const onRevoke = async (id: string) => {
    await revoke({ data: { id } });
    await refresh();
  };

  const copy = async () => {
    if (!fullUrl) return;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copie impossible, sélectionne l'adresse à la main.");
    }
  };

  const current = PROVIDERS.find((p) => p.id === provider)!;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center" role="dialog" aria-label="Connexion MCP">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-black/60 animate-in fade-in duration-200" />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-background/95 shadow-2xl backdrop-blur-2xl animate-in slide-in-from-bottom duration-300 sm:rounded-[28px]">
        <header className="flex items-start justify-between gap-3 px-6 pt-6">
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Plug className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-xl font-semibold tracking-tight text-foreground">Connexion MCP</h2>
            <p className="mt-1 text-sm text-muted-foreground">Utilise Sam Flash directement depuis Claude ou ChatGPT.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-8 pt-6">
          {/* 1. Choix de l'assistant */}
          <div className="grid grid-cols-2 gap-2 rounded-full bg-white/[0.04] p-1">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProvider(p.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${provider === p.id ? "bg-foreground text-background" : "text-muted-foreground"}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* 2. Clé et adresse */}
          <section className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <KeyRound className="h-4 w-4" /> Étape 1 · Crée ta clé
            </div>
            {!fresh && (
              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`Nom (ex. ${current.label})`}
                  maxLength={60}
                  className="min-w-0 flex-1 rounded-full border border-white/10 bg-background px-4 py-2.5 text-sm outline-none focus:border-primary/60"
                />
                <button type="button" disabled={busy} onClick={() => void onCreate()} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">
                  Créer
                </button>
              </div>
            )}
            {fresh && fullUrl && (
              <div className="space-y-3">
                <p className="text-xs text-amber-300">Copie cette adresse maintenant. Elle ne sera plus affichée en entier.</p>
                <code className="block break-all rounded-2xl bg-black/40 p-3 text-xs text-foreground">{fullUrl}</code>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void copy()} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copié" : "Copier l'adresse"}
                  </button>
                  <button type="button" onClick={() => setFresh(null)} className="rounded-full border border-white/10 px-4 py-2.5 text-sm text-muted-foreground">
                    Terminé
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* 3. Mode d'emploi par assistant */}
          <section className="space-y-3">
            <div className="text-sm font-semibold text-foreground">Étape 2 · Connecte {current.label}</div>
            <p className="text-sm text-muted-foreground">{current.hint}</p>
            <ol className="space-y-3">
              {current.steps.map((step, i) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-foreground">{i + 1}</span>
                  <span className="pt-0.5 text-sm leading-6 text-foreground/90">{step}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* 4. Clés existantes */}
          {keys.length > 0 && (
            <section className="space-y-2">
              <div className="text-sm font-semibold text-foreground">Tes clés</div>
              <ul className="space-y-2">
                {keys.map((k) => (
                  <li key={k.id} className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 p-3">
                    <span className="text-xs text-foreground">
                      {k.name} · {k.key_prefix}… {k.revoked_at ? "(révoquée)" : ""}
                    </span>
                    {!k.revoked_at && (
                      <button type="button" onClick={() => void onRevoke(k.id)} className="text-xs text-red-400">
                        Révoquer
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
