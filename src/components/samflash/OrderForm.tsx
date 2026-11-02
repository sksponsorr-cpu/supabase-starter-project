import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createPublicOrder } from "@/lib/orders.functions";
import { supabase } from "@/integrations/supabase/client";
import { CustomerAuth } from "@/components/shop/CustomerAuth";

type Props = {
  shopUserId: string;
  shopName: string;
  waPhone: string;
  product: { id: string; name: string; price: string };
  onClose: () => void;
};

/**
 * Commande depuis la boutique. Le client doit avoir un compte pour commander.
 * La commande décrémente le stock, puis on propose de suivre la livraison.
 */
export function OrderForm({ shopUserId, shopName, waPhone, product, onClose }: Props) {
  const create = useServerFn(createPublicOrder);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [delivery, setDelivery] = useState<"livraison" | "retrait">("livraison");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; trackingCode: string } | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setLoggedIn(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setLoggedIn(Boolean(session)));
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await create({
        data: { shopUserId, productId: product.id, quantity, name, phone, address, delivery },
      });
      if (!r.ok || !r.id || !r.trackingCode) throw new Error(r.message ?? "Commande impossible.");
      setDone({ id: r.id, trackingCode: r.trackingCode });
      const text =
        `Commande ${r.trackingCode} — ${shopName}\n` +
        `Article : ${product.name} (x${quantity})\n` +
        `Prix : ${product.price}\n` +
        `Nom : ${name}\nTéléphone : ${phone}\n` +
        `${delivery === "retrait" ? "Retrait en boutique" : `Livraison : ${address}`}`;
      window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Commande impossible.");
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-600";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 text-slate-900 shadow-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black">{done ? "Commande reçue" : "Votre commande"}</h2>
          <button onClick={onClose} className="rounded-full px-3 py-1 text-sm text-slate-500">Fermer</button>
        </div>

        {loggedIn === null && <p className="text-sm text-slate-500">Chargement…</p>}

        {loggedIn === false && <CustomerAuth onReady={() => setLoggedIn(true)} />}

        {loggedIn && done && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Ta commande <strong>{done.trackingCode}</strong> est enregistrée. Le vendeur a été prévenu.
            </p>
            <a
              href={`/suivi-commande?id=${done.id}`}
              className="block w-full rounded-full bg-blue-700 py-3 text-center text-sm font-bold text-white"
            >
              Suivre ma commande
            </a>
          </div>
        )}

        {loggedIn && !done && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 p-3 text-sm">
              <p className="font-semibold">{product.name}</p>
              <p className="text-slate-500">{product.price || "Prix à confirmer"}</p>
            </div>

            <label className="block text-sm font-semibold">
              Quantité
              <input className={`${input} mt-1`} type="number" min={1} max={100} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
            </label>

            <div className="grid grid-cols-2 gap-2 rounded-full bg-slate-100 p-1 text-sm font-semibold">
              <button type="button" onClick={() => setDelivery("livraison")} className={`rounded-full py-2 ${delivery === "livraison" ? "bg-white shadow" : "text-slate-500"}`}>Livraison</button>
              <button type="button" onClick={() => setDelivery("retrait")} className={`rounded-full py-2 ${delivery === "retrait" ? "bg-white shadow" : "text-slate-500"}`}>Retrait</button>
            </div>

            <input className={input} placeholder="Ton nom" value={name} onChange={(e) => setName(e.target.value)} />
            <input className={input} placeholder="Téléphone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            {delivery === "livraison" && (
              <textarea className={input} rows={3} placeholder="Adresse de livraison" value={address} onChange={(e) => setAddress(e.target.value)} />
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="button"
              disabled={busy || name.trim().length < 2 || phone.trim().length < 6 || (delivery === "livraison" && address.trim().length < 5)}
              onClick={submit}
              className="w-full rounded-full bg-blue-700 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? "Envoi…" : "Confirmer ma commande"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
