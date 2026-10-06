import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Inbox, Loader2, RefreshCw, RotateCcw, Search, Send } from "lucide-react";
import { listSupportInbox } from "@/lib/support-inbox.functions";
import {
  listSupportReplies,
  replyToSupportMessage,
  updateSupportStatus,
  type SupportMessage,
  type SupportReply,
} from "@/lib/support.functions";
import { EmptyState } from "@/components/samflash/EmptyState";
import { toast } from "@/lib/toast";
import { timeAgo } from "@/lib/time-ago";

const PAGE_SIZE = 10;

type Filter = "all" | "ouvert" | "repondu" | "resolu";
type Counts = { all: number; ouvert: number; repondu: number; resolu: number };

const STATUS: Record<string, { label: string; cls: string }> = {
  ouvert: { label: "À traiter", cls: "bg-amber-500/15 text-amber-500" },
  repondu: { label: "Répondu", cls: "bg-blue-500/15 text-blue-400" },
  resolu: { label: "Résolu", cls: "bg-emerald-500/15 text-emerald-500" },
};

/** Boîte de support professionnelle : filtres, recherche, fils de discussion, pagination. */
export function AdminSupportPanel() {
  const fetchInbox = useServerFn(listSupportInbox);
  const fetchReplies = useServerFn(listSupportReplies);
  const sendReply = useServerFn(replyToSupportMessage);
  const setStatus = useServerFn(updateSupportStatus);

  const [items, setItems] = useState<SupportMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Counts>({ all: 0, ouvert: 0, repondu: 0, resolu: 0 });
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [openId, setOpenId] = useState<string | null>(null);
  const [replies, setReplies] = useState<SupportReply[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const reqId = useRef(0);

  const load = useCallback(
    async (append = false, offset = 0) => {
      const id = ++reqId.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await fetchInbox({ data: { offset, limit: PAGE_SIZE, status: filter, q: query } });
        if (id !== reqId.current) return;
        setItems((prev) => (append ? [...prev, ...res.items] : res.items));
        setTotal(res.total);
        setCounts(res.counts);
      } catch {
        if (id === reqId.current) toast.error("Impossible de charger les messages.");
      } finally {
        if (id === reqId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [fetchInbox, filter, query],
  );

  useEffect(() => {
    void load(false, 0);
  }, [load]);

  // Recherche : on attend la fin de la saisie avant d'interroger le serveur.
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const openThread = async (id: string) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    setText("");
    setReplies([]);
    setRepliesLoading(true);
    try {
      setReplies(await fetchReplies({ data: { messageId: id } }));
    } catch {
      toast.error("Impossible de charger la conversation.");
    } finally {
      setRepliesLoading(false);
    }
  };

  const send = async (ticket: SupportMessage) => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const res = await sendReply({ data: { messageId: ticket.id, body } });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setText("");
      setReplies(await fetchReplies({ data: { messageId: ticket.id } }));
      toast.success("Réponse envoyée au client.");
      await load(false, 0);
    } catch {
      toast.error("Envoi impossible.");
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (ticket: SupportMessage, status: "ouvert" | "resolu") => {
    try {
      const res = await setStatus({ data: { messageId: ticket.id, status } });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(status === "resolu" ? "Ticket marqué comme résolu." : "Ticket rouvert.");
      await load(false, 0);
    } catch {
      toast.error("Mise à jour impossible.");
    }
  };

  const filters: { id: Filter; label: string; n: number }[] = [
    { id: "all", label: "Tous", n: counts.all },
    { id: "ouvert", label: "À traiter", n: counts.ouvert },
    { id: "repondu", label: "Répondus", n: counts.repondu },
    { id: "resolu", label: "Résolus", n: counts.resolu },
  ];

  return (
    <section className="pt-5">
      <div className="flex items-center gap-2">
        <h2 className="text-[22px] font-semibold tracking-tight">Boîte de support</h2>
        <button
          type="button"
          onClick={() => void load(false, 0)}
          aria-label="Actualiser"
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-secondary transition-transform active:scale-95"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Chaque réponse envoyée notifie le client. Un message de suivi du client rouvre le ticket.
      </p>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un e-mail ou un mot…"
          aria-label="Rechercher dans le support"
          className="w-full rounded-full border border-border/70 bg-card/50 py-3 pl-11 pr-4 text-sm outline-none backdrop-blur-xl placeholder:text-muted-foreground focus:border-primary/60"
        />
      </div>

      <div className="hide-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setOpenId(null);
              setFilter(f.id);
            }}
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${
              filter === f.id
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
            <span
              className={`rounded-full px-1.5 text-[11px] ${
                filter === f.id ? "bg-background/20" : "bg-background/40"
              }`}
            >
              {f.n}
            </span>
          </button>
        ))}
      </div>

      <ul className="mt-4 space-y-3">
        {loading && items.length === 0
          ? Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="h-24 animate-pulse rounded-3xl bg-secondary/50" />
            ))
          : items.map((tkt) => {
              const st = STATUS[tkt.status] ?? { label: tkt.status, cls: "bg-secondary text-muted-foreground" };
              const initial = (tkt.email ?? "?").charAt(0).toUpperCase();
              const isOpen = openId === tkt.id;
              return (
                <li
                  key={tkt.id}
                  className={`overflow-hidden rounded-3xl border bg-card/50 backdrop-blur-xl transition-colors ${
                    tkt.status === "ouvert" ? "border-amber-500/40" : "border-border/70"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void openThread(tkt.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-start gap-3 p-4 text-left"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                      {initial}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-semibold">{tkt.email ?? "Utilisateur"}</span>
                        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                          {timeAgo(tkt.created_at)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>
                          {st.label}
                        </span>
                        <span className="truncate text-[13px] text-muted-foreground">{tkt.subject}</span>
                      </span>
                      {!isOpen && (
                        <span className="mt-1.5 line-clamp-2 text-[13px] text-foreground/80">{tkt.body}</span>
                      )}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-border/60 px-4 pb-4 pt-3">
                      <div className="rounded-2xl bg-secondary px-3.5 py-3 text-[14px]">
                        <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                          Message initial · {new Date(tkt.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                        <p className="whitespace-pre-wrap">{tkt.body}</p>
                      </div>

                      {repliesLoading ? (
                        <div className="mt-3 h-12 animate-pulse rounded-2xl bg-secondary/50" />
                      ) : (
                        <ul className="mt-3 space-y-2">
                          {replies.map((r) => (
                            <li key={r.id} className={`flex ${r.is_staff ? "justify-end" : "justify-start"}`}>
                              <div
                                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[14px] ${
                                  r.is_staff ? "bg-primary text-primary-foreground" : "bg-secondary"
                                }`}
                              >
                                <p
                                  className={`mb-0.5 text-[11px] ${
                                    r.is_staff ? "text-primary-foreground/70" : "text-muted-foreground"
                                  }`}
                                >
                                  {r.is_staff ? "Équipe" : "Client"} · {timeAgo(r.created_at)}
                                </p>
                                <p className="whitespace-pre-wrap">{r.body}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}

                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        aria-label="Votre réponse"
                        rows={3}
                        placeholder="Répondre au client…"
                        className="mt-3 w-full resize-none rounded-2xl border border-border bg-background/60 px-3.5 py-3 text-[14px] outline-none focus:border-primary/60"
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={sending || text.trim().length === 0}
                          onClick={() => void send(tkt)}
                          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-transform active:scale-95 disabled:opacity-50"
                        >
                          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          Envoyer
                        </button>
                        {tkt.status === "resolu" ? (
                          <button
                            type="button"
                            onClick={() => void changeStatus(tkt, "ouvert")}
                            className="inline-flex items-center gap-2 rounded-full bg-secondary px-5 py-2.5 text-[13px] font-medium"
                          >
                            <RotateCcw className="h-4 w-4" /> Rouvrir
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void changeStatus(tkt, "resolu")}
                            className="inline-flex items-center gap-2 rounded-full bg-secondary px-5 py-2.5 text-[13px] font-medium"
                          >
                            <CheckCircle2 className="h-4 w-4" /> Marquer résolu
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
      </ul>

      {!loading && items.length === 0 && (
        <div className="mt-4">
          <EmptyState
            icon={Inbox}
            title={query || filter !== "all" ? "Aucun résultat" : "Aucun message de support"}
            description={
              query || filter !== "all"
                ? "Essayez un autre filtre ou un autre mot-clé."
                : "Les messages de vos utilisateurs apparaîtront ici."
            }
          />
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-5 flex flex-col items-center gap-2">
          <p className="text-xs text-muted-foreground">
            {items.length} sur {total} message{total > 1 ? "s" : ""}
          </p>
          {items.length < total && (
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void load(true, items.length)}
              className="inline-flex items-center gap-2 rounded-full bg-secondary px-6 py-2.5 text-[13px] font-medium disabled:opacity-60"
            >
              {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
              Voir plus
            </button>
          )}
        </div>
      )}
    </section>
  );
}
