import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getWallets, transferToSeller } from "@/lib/seller-wallet.functions";
import { toast } from "@/lib/toast";

/** Soldes et transfert créateur -> vendeur (3 crédits créateur = 1 crédit vendeur). */
export function TransferCredits() {
  const load = useServerFn(getWallets);
  const send = useServerFn(transferToSeller);
  const [w, setW] = useState<{ creator: number; seller: number; rate: number } | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => load({}).then(setW).catch(() => setW(null));
  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const onTransfer = async () => {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n < 1) return toast("Indique un nombre de crédits vendeur (1 minimum).");
    setBusy(true);
    try {
      const r = await send({ data: { sellerAmount: n } });
      toast(r.message);
      if (r.ok) setAmount("");
      await refresh();
    } catch {
      toast("Transfert impossible pour le moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="w-full max-w-2xl px-4 mb-6">
      <div className="rounded-3xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between text-sm">
          <div>
            <p className="text-muted-foreground">Crédits créateur</p>
            <p className="text-lg font-semibold text-foreground">{w?.creator ?? "—"}</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">Crédits vendeur</p>
            <p className="text-lg font-semibold text-foreground">{w?.seller ?? "—"}</p>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Transférer des crédits créateur vers vendeur : 3 crédits créateur = 1 crédit vendeur. Le transfert est définitif.</p>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Crédits vendeur à obtenir"
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void onTransfer()}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              Transférer
            </button>
          </div>
          {amount && Number(amount) > 0 && (
            <p className="text-xs text-muted-foreground">Cela coûte {Math.floor(Number(amount)) * 3} crédits créateur.</p>
          )}
        </div>
      </div>
    </section>
  );
}
