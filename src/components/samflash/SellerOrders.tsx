import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy } from "lucide-react";
import { listShopOrders, updateOrderStatus } from "@/lib/orders.functions";
import { supabase } from "@/integrations/supabase/client";
import { ORDER_STATUSES, trackingLink } from "./shared";

type Order = {
  id: string;
  product_name: string;
  unit_price: string;
  quantity: number;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  delivery_method: string;
  status: string;
  tracking_code: string;
  created_at: string;
};

/** Commandes reçues. Une nouvelle commande apparaît sans recharger la page. */
export function SellerOrders({ userId }: { userId: string }) {
  const list = useServerFn(listShopOrders);
  const update = useServerFn(updateOrderStatus);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>("toutes");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setOrders((await list()) as Order[]);
  }, [list]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`seller-orders-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shop_orders", filter: `user_id=eq.${userId}` }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, load]);

  const apply = async (o: Order) => {
    setError(null);
    const status = statuses[o.id] ?? o.status;
    const note = notes[o.id] ?? "";
    const r = await update({ data: { id: o.id, status: status as (typeof ORDER_STATUSES)[number], note } });
    if (!r.ok) return setError(r.message ?? "Mise à jour impossible.");
    setNotes((n) => ({ ...n, [o.id]: "" }));
    void load();
  };

  const copyTrack = async (o: Order) => {
    await navigator.clipboard.writeText(trackingLink(o.id));
    setCopied(o.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const shown = filter === "toutes" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {["toutes", ...ORDER_STATUSES].map((s) => (
          <button key={s} type="button" onClick={() => setFilter(s)} className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${filter === s ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`}>
            {s}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {shown.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Aucune commande.</p>}

      {shown.map((o) => (
        <article key={o.id} className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-900">{o.product_name} <span className="text-slate-500">x{o.quantity}</span></p>
              <p className="text-xs text-slate-500">{o.tracking_code} · {new Date(o.created_at).toLocaleString("fr-FR")}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">{o.status}</span>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3 text-sm">
            <p className="font-medium text-slate-900">{o.customer_name} · {o.customer_phone}</p>
            <p className="text-slate-600">{o.delivery_method === "retrait" ? "Retrait en boutique" : o.customer_address || "Adresse non renseignée"}</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <select className="rounded-2xl border border-slate-200 p-2.5 text-sm" value={statuses[o.id] ?? o.status} onChange={(e) => setStatuses((s) => ({ ...s, [o.id]: e.target.value }))}>
              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input className="rounded-2xl border border-slate-200 p-2.5 text-sm" placeholder="Note pour le client (ex : livreur à 10 min)" maxLength={300} value={notes[o.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [o.id]: e.target.value }))} />
            <button type="button" onClick={() => apply(o)} className="rounded-2xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white">Mettre à jour</button>
          </div>

          <button type="button" onClick={() => copyTrack(o)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
            <Copy className="h-3.5 w-3.5" /> {copied === o.id ? "Lien copié" : "Copier le lien de suivi pour le client"}
          </button>
        </article>
      ))}
    </div>
  );
}
