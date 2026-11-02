import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createPublicOrder } from "@/lib/orders.functions";

type Props = {
  shopUserId: string;
  shopName: string;
  waPhone: string;
  product: { id: string; name: string; price: string };
  onClose: () => void;
};

/** Commande depuis la boutique : on enregistre la commande, puis on ouvre WhatsApp avec le numéro de commande. */
export function OrderForm({ shopUserId, shopName, waPhone, product, onClose }: Props) {
  const create = useServerFn(createPublicOrder);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await create({ data: { shopUserId, productId: product.id, quantity, name, phone, address } });
      if (!r.ok || !r.id) throw new Error(r.message ?? "Commande impossible.");
      setOrderId(r.id);
      const ref = r.id.slice(0, 8).toUpperCase();
      const text =
        `Commande ${ref} — ${shopName}\n` +
        `Article : ${product.name} (x${quantity})\n` +
        `Prix : ${product.price}\n` +
        `Nom : ${name}\nTéléphone : ${phone}\nLivraison : ${address || "à préciser"}`;
      window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Commande impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 text-slate-900 shadow-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black">Votre commande</h2>
          <button onClick={onClose} className="rounded-full px-3 py-1 text-sm text-slate-500">Fermer</button>
        </div>
        <p className="mb-4 text-sm text-slate-600">{product.name} · {product.price}</p>

        {orderId ? (
          <div className="space-y-3 text-sm">
            <p className="font-semibold">Commande enregistrée. Référence : {orderId.slice(0, 8).toUpperCase()}</p>
            <p className="text-slate-600">Le vendeur confirme votre commande sur WhatsApp.</p>
            <button onClick={onClose} className="w-full rounded-full bg-blue-700 py-3 font-bold text-white">Terminer</button>
          </div>
        ) : (
          <div className="space-y-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom complet" className="w-full rounded-xl border border-slate-200 p-3 text-sm" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone" className="w-full rounded-xl border border-slate-200 p-3 text-sm" />
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Adresse ou quartier de livraison" className="w-full rounded-xl border border-slate-200 p-3 text-sm" />
            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm">
              <span>Quantité</span>
              <div className="flex items-center gap-3">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="h-8 w-8 rounded-full bg-slate-100 font-bold">−</button>
                <span className="w-6 text-center font-bold">{quantity}</span>
                <button onClick={() => setQuantity(Math.min(100, quantity + 1))} className="h-8 w-8 rounded-full bg-slate-100 font-bold">+</button>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={submit}
              disabled={busy || name.trim().length < 2 || phone.trim().length < 6}
              className="w-full rounded-full bg-blue-700 py-3 font-bold text-white disabled:opacity-50"
            >
              {busy ? "Envoi…" : "Confirmer ma commande"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
