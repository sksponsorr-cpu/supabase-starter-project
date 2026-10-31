import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Send, Loader2 } from "lucide-react";
import { sendNotification } from "@/lib/notifications.functions";
import { toast } from "@/lib/toast";

const KINDS = [
  { id: "nouveaute", label: "Nouveauté" },
  { id: "offre", label: "Offre" },
  { id: "modele", label: "Modèle" },
  { id: "abonnement", label: "Abonnement" },
  { id: "info", label: "Information" },
  { id: "maintenance", label: "Maintenance" },
] as const;

const field = "w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm text-foreground";

/** Envoi de notifications à tous les utilisateurs, ou à un seul (par son identifiant). */
export function AdminNotificationsPanel() {
  const send = useServerFn(sendNotification);
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("nouveaute");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [allUsers, setAllUsers] = useState(true);
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!window.confirm(allUsers ? "Envoyer cette notification à TOUS les utilisateurs ?" : "Envoyer cette notification à cet utilisateur ?")) return;
    setBusy(true);
    try {
      const res = await send({ data: { userId: allUsers ? null : userId.trim(), kind, title, body } });
      if (res.ok) {
        toast.success(`Notification envoyée (${res.sent}).`);
        setTitle("");
        setBody("");
      } else toast.error(res.message);
    } catch {
      toast.error("Envoi impossible. Vérifie les champs.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="pt-5">
      <h2 className="text-[22px] font-semibold tracking-tight">Notifications</h2>
      <p className="mt-1 text-sm text-muted-foreground">Informe les utilisateurs des nouveautés, offres, modèles et abonnements.</p>
      <div className="mt-4 space-y-3 rounded-3xl border border-border/70 bg-card/50 p-5">
        <label className="block text-xs font-medium text-muted-foreground">
          Type
          <select className={`${field} mt-1`} value={kind} onChange={(e) => setKind(e.target.value as (typeof KINDS)[number]["id"])}>
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>{k.label}</option>
            ))}
          </select>
        </label>
        <input className={field} placeholder="Titre (ex. Nouveau modèle disponible)" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className={field} rows={4} placeholder="Message" maxLength={600} value={body} onChange={(e) => setBody(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allUsers} onChange={(e) => setAllUsers(e.target.checked)} className="h-4 w-4" />
          Envoyer à tous les utilisateurs
        </label>
        {!allUsers && <input className={field} placeholder="Identifiant de l'utilisateur (UUID)" value={userId} onChange={(e) => setUserId(e.target.value)} />}
        <button type="button" disabled={busy || title.trim().length < 2 || body.trim().length < 2} onClick={() => void submit()} className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3 text-sm font-semibold text-background disabled:opacity-40">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Envoyer la notification
        </button>
      </div>
    </section>
  );
}
