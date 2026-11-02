import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listShopOrders, setOrderStatus } from "@/lib/orders.functions";

type Order = {
  id: string;
  product_name: string;
  unit_price: string;
  quantity: number;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  status: string;
  created_at: string;
};

const STATUSES = ["nouvelle", "confirmée", "en livraison", "livrée", "annulée"];

/** Espace vendeur : commandes reçues, avec statut modifiable. */
export function VendorOrders() {
  const list = useServerFn(listShopOrders);
  const update = useServerFn(setOrderStatus);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>("toutes");

  const load = async () => setOrders((await list()) as Order[]);
  useEffect(() => {
    void load();
  }, []);

  const shown = filter === "toutes" ? orders : orders.filter((o) => o.status === filter);
  const counts = (s: string) => orders.filter((o) => o.status === s).length;

  const change = async (id: string, status: string) => {
    await update({ data: { id, status: status as (typeof STATUSES)[number] } });
    await load();
  };

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Commandes" value={orders.length} />
        <Stat label="Nouvelles" value={counts("nouvelle")} />
        <Stat label="En livraison" value={counts("en livraison")} />
        <Stat label="Livrées" value={counts("livrée")} />
      </div>

      <div className="flex flex-wrap gap-2">
        {["toutes", ...STATUSES].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === s ? "bg-white text-black" : "border border-white/15"}`}>
            {s}
          </button>
        ))}
      </div>

      {shown.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Aucune commande pour le moment.</p>}

      <div className="divide-y divide-white/10">
        {shown.map((o) => (
          <article key={o.id} className="space-y-2 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{o.product_name} <span className="text-muted-foreground">× {o.quantity}</span></p>
                <p className="text-xs text-muted-foreground">{o.customer_name} · {o.customer_phone}</p>
                {o.customer_address && <p className="text-xs text-muted-foreground">{o.customer_address}</p>}
                <p className="text-xs text-muted-foreground">Réf. {o.id.slice(0, 8).toUpperCase()} · {new Date(o.created_at).toLocaleString("fr-FR")}</p>
              </div>
              <select value={o.status} onChange={(e) => change(o.id, e.target.value)} className="rounded-lg bg-[#3a3b3c] p-2 text-xs">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/5 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
