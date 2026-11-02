import { useCallback, useEffect, useState } from "react";
import { Check, Package, Truck, Store, X } from "lucide-react";
import { db } from "@/components/seller-space/shared";
import { supabase } from "@/integrations/supabase/client";

type Order = {
  id: string;
  product_name: string;
  unit_price: string;
  quantity: number;
  status: string;
  delivery_method: string;
  customer_address: string;
  tracking_code: string;
  created_at: string;
  updated_at: string;
};
type Event = { id: string; status: string; note: string; created_at: string };

const STEPS = [
  { key: "nouvelle", label: "Commande reçue", icon: Package },
  { key: "confirmée", label: "Confirmée", icon: Check },
  { key: "en livraison", label: "En livraison", icon: Truck },
  { key: "livrée", label: "Livrée", icon: Store },
] as const;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** Suivi d'une commande pour le client connecté. Se met à jour en direct quand le vendeur change le statut. */
export function OrderTracking({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [events, setEvents] = useState<Event[]>([]);
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    const [o, e] = await Promise.all([
      db.from("shop_orders").select("*").eq("id", orderId).maybeSingle(),
      db.from("shop_order_events").select("*").eq("order_id", orderId).order("created_at", { ascending: true }),
    ]);
    setOrder((o.data as Order) ?? null);
    setEvents((e.data as Event[]) ?? []);
  }, [orderId]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`order-tracking-${orderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shop_orders", filter: `id=eq.${orderId}` }, () => void load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "shop_order_events", filter: `order_id=eq.${orderId}` }, () => void load())
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orderId, load]);

  if (order === undefined) return <p className="p-8 text-center text-sm text-slate-500">Chargement…</p>;
  if (order === null) {
    return <p className="p-8 text-center text-sm text-slate-500">Commande introuvable. Vérifie que tu es connecté avec le compte qui a passé la commande.</p>;
  }

  const cancelled = order.status === "annulée";
  const currentIndex = STEPS.findIndex((s) => s.key === order.status);
  const isPickup = order.delivery_method === "retrait";

  return (
    <div className="mx-auto max-w-xl space-y-6 p-5 text-slate-900">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Commande {order.tracking_code}</p>
        <h1 className="text-2xl font-black">{order.product_name}</h1>
        <p className="text-sm text-slate-600">
          x{order.quantity} · {order.unit_price || "prix à confirmer"} · {isPickup ? "Retrait en boutique" : "Livraison"}
        </p>
        <p className="flex items-center gap-2 text-xs text-slate-400">
          <span className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500" : "bg-slate-300"}`} />
          {live ? "Suivi en direct" : "Connexion au suivi…"}
        </p>
      </header>

      {cancelled ? (
        <div className="flex items-center gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
          <X className="h-5 w-5" /> Cette commande a été annulée.
        </div>
      ) : (
        <ol className="space-y-4">
          {STEPS.map((step, i) => {
            const done = i <= currentIndex;
            const Icon = step.icon;
            return (
              <li key={step.key} className="flex items-center gap-4">
                <span className={`flex h-10 w-10 items-center justify-center rounded-full ${done ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-400"}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className={`font-semibold ${done ? "text-slate-900" : "text-slate-400"}`}>{step.label}</span>
              </li>
            );
          })}
        </ol>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Historique</h2>
        {events.length === 0 && <p className="text-sm text-slate-500">Aucune mise à jour pour l'instant.</p>}
        <ul className="space-y-3 border-l-2 border-slate-200 pl-4">
          {[...events].reverse().map((ev) => (
            <li key={ev.id} className="relative">
              <span className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-700" />
              <p className="text-sm font-semibold capitalize">{ev.status}</p>
              {ev.note && <p className="text-sm text-slate-600">{ev.note}</p>}
              <p className="text-xs text-slate-400">{fmtDate(ev.created_at)}</p>
            </li>
          ))}
        </ul>
      </section>

      {!isPickup && (
        <section className="rounded-2xl bg-slate-50 p-4 text-sm">
          <p className="font-semibold">Adresse de livraison</p>
          <p className="text-slate-600">{order.customer_address || "Non renseignée"}</p>
        </section>
      )}
    </div>
  );
}
