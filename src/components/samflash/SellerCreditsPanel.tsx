import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getWallets } from "@/lib/seller-wallet.functions";
import { TransferCredits } from "@/components/samflash/TransferCredits";
import { toast } from "@/lib/toast";
import { startPayment, listCountries, listPaymentMethods, listPrices, type PriceRow } from "@/lib/payments.functions";
import { addPaymentFees } from "@/lib/payments/fees";
import { EUR_TO_FCFA } from "@/lib/pricing-fcfa";

const PACKS = [
  { id: "seller_pack_10", name: "Essentiel", seller: 10, bonus: "0 %" },
  { id: "seller_pack_30", name: "Pro", seller: 30, bonus: "+10 %" },
  { id: "seller_pack_100", name: "Business", seller: 100, bonus: "+20 %" },
];

/** Bouton des crédits (en haut de l'espace vendeur) et tableau de bord de conversion. */
export function SellerCreditsPill() {
  const load = useServerFn(getWallets);
  const [w, setW] = useState<{ creator: number; seller: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [pack, setPack] = useState<(typeof PACKS)[number] | null>(null);
  const [country, setCountry] = useState("");
  const [method, setMethod] = useState("");
  const [mobile, setMobile] = useState("");
  const [fullName, setFullName] = useState("");
  const [methods, setMethods] = useState<{ code: string; label: string }[]>([]);
  const [paying, setPaying] = useState(false);
  const getCountries = useServerFn(listCountries);
  const getMethods = useServerFn(listPaymentMethods);
  const pay = useServerFn(startPayment);
  const [countries, setCountries] = useState<{ code: string; name: string }[]>([]);
  const getPrices = useServerFn(listPrices);
  const [prices, setPrices] = useState<PriceRow[]>([]);

  useEffect(() => {
    void getPrices({}).then((rows) => setPrices(rows as PriceRow[])).catch(() => setPrices([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const priceLabel = (id: string) => {
    const row = prices.find((r) => r.id === id);
    if (!row) return "Indisponible";
    const base = Math.round((Number(row.amount_eur) * EUR_TO_FCFA) / 100) * 100;
    return `${addPaymentFees(base, true).total.toLocaleString("fr-FR")} FCFA`;
  };

  useEffect(() => {
    void getCountries({}).then((c) => setCountries(c as { code: string; name: string }[])).catch(() => setCountries([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!country) { setMethods([]); return; }
    void getMethods({ data: { countryCode: country } })
      .then((r) => setMethods((r.methods ?? []) as { code: string; label: string }[]))
      .catch(() => setMethods([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  const checkout = async () => {
    if (!pack || !country || !method || mobile.trim().length < 6 || fullName.trim().length < 2) {
      return toast("Complète le pays, le moyen de paiement, le numéro et le nom.");
    }
    setPaying(true);
    try {
      const r = await pay({ data: { productId: pack.id, countryCode: country, paymentMethod: method, mobile: mobile.trim(), fullName: fullName.trim(), period: "monthly" } });
      if (r.ok && "checkoutUrl" in r && r.checkoutUrl) {
        window.location.assign(r.checkoutUrl as string);
      } else {
        toast(("message" in r ? (r.message as string) : null) ?? "Paiement impossible pour le moment.");
      }
    } catch {
      toast("Paiement impossible pour le moment.");
    } finally {
      setPaying(false);
    }
  };

  const refresh = () => load({}).then(setW).catch(() => setW(null));
  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); void refresh(); }}
        className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300"
      >
        <span aria-hidden>🗄</span>
        {w ? `${w.seller} crédits` : "Crédits"}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end bg-black/70" role="dialog" aria-label="Crédits vendeur">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-[#0b0b14] p-5 text-white">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-semibold">Mes crédits</p>
              <button type="button" onClick={() => setOpen(false)} className="text-sm text-white/60">Fermer</button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl border border-white/10 p-4">
                <p className="text-xs text-white/50">Crédits vendeur</p>
                <p className="mt-1 text-2xl font-bold">{w?.seller ?? "—"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 p-4">
                <p className="text-xs text-white/50">Crédits créateur</p>
                <p className="mt-1 text-2xl font-bold">{w?.creator ?? "—"}</p>
              </div>
            </div>

            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold">Transférer des crédits créateur</p>
              <TransferCredits />
            </div>

            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold">Recharger des crédits vendeur</p>
              <div className="space-y-2">
                {PACKS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!prices.some((r) => r.id === p.id)} onClick={() => setPack(p)}
                    className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left ${pack?.id === p.id ? "border-violet-500" : "border-white/10"}`}
                  >
                    <span>
                      <span className="block text-sm font-semibold">{p.name}</span>
                      <span className="block text-xs text-white/50">{p.seller} crédits vendeur {p.bonus !== "0 %" ? `(${p.bonus} offert)` : ""}</span>
                    </span>
                    <span className="text-right"><span className="block text-sm font-semibold">{priceLabel(p.id)}</span><span className="block text-xs font-semibold text-violet-300">Choisir</span></span>
                  </button>
                ))}
              </div>

              {pack && (
                <div className="mt-4 space-y-3 rounded-2xl border border-white/10 p-4">
                  <p className="text-sm font-semibold">Payer le pack {pack.name}</p>
                  <select value={country} onChange={(e) => { setCountry(e.target.value); setMethod(""); }} className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm">
                    <option value="">Pays</option>
                    {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                  <select value={method} onChange={(e) => setMethod(e.target.value)} disabled={!country} className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm">
                    <option value="">Moyen de paiement</option>
                    {methods.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
                  </select>
                  <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Numéro de téléphone" className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm" />
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nom complet" className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm" />
                  <button type="button" disabled={paying} onClick={() => void checkout()} className="w-full rounded-full bg-violet-600 py-3 text-sm font-semibold text-white disabled:opacity-40">
                    {paying ? "Redirection…" : "Payer avec Swychr"}
                  </button>
                </div>
              )}
              <p className="mt-2 text-xs text-white/40">Les packs vendeur sont activés par l'administrateur dans l'onglet Tarifs.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
