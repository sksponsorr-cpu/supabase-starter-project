import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { listMyNotifications, markNotificationsRead } from "@/lib/notifications.functions";

type Item = { id: string; kind: string; title: string; body: string; created_at: string; read_at: string | null };

/** Cloche de notifications : liste, nombre non lu, et marquage comme lu à l'ouverture. */
export function NotificationBell() {
  const list = useServerFn(listMyNotifications);
  const markRead = useServerFn(markNotificationsRead);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const refresh = () =>
    list()
      .then((res) => {
        if (res.ok) {
          setItems(res.items as Item[]);
          setUnread(res.unread);
        }
      })
      .catch(() => undefined);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await markRead().catch(() => undefined);
      setUnread(0);
    }
  };

  return (
    <div className="relative">
      <button type="button" aria-label="Notifications" onClick={() => void toggle()} className="relative flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 max-h-96 w-80 max-w-[90vw] overflow-y-auto rounded-2xl border border-border bg-background p-3 shadow-xl">
          {items.length === 0 && <p className="p-3 text-sm text-muted-foreground">Aucune notification.</p>}
          {items.map((n) => (
            <div key={n.id} className={`mb-2 rounded-xl p-3 ${n.read_at ? "bg-card/40" : "bg-card"}`}>
              <p className="text-sm font-semibold">{n.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{n.body}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString("fr-FR")}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
