import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listPromoCodes, savePromoCode, togglePromoCode, type PromoCodeRow } from "@/lib/promo-admin.functions";
import { toast } from "@/lib/toast";

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const emptyForm = () => {
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 86_400_000);
  return {
    code: "",
    discount: "",
    startsAt: toLocalInput(now.toISOString()),
    endsAt: toLocalInput(end.toISOString()),
    maxUses: "",
    active: true,
    isNew: true,
  };
};

export function AdminPromoPanel() {
  const fetchList = useServerFn(listPromoCodes);
  const save = useServerFn(savePromoCode);
  const toggle = useServerFn(togglePromoCode);
  const [rows, setRows] = useState<PromoCodeRow[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetchList({})
      .then(setRows)
      .catch(() => toast.error("Impossible de charger les codes promo."));

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const edit = (r: PromoCodeRow) =>
    setForm({
      code: r.code,
      discount: String(r.discount_eur),
      startsAt: toLocalInput(r.starts_at),
      endsAt: toLocalInput(r.ends_at),
      maxUses: r.max_uses === null ? "" : String(r.max_uses),
      active: r.active,
      isNew: false,
    });

  const submit = async () => {
    setBusy(true);
    try {
      const res = await save({
        data: {
          code: form.code,
          discountEur: Number(form.discount),
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
          maxUses: form.maxUses.trim() === "" ? null : Number(form.maxUses),
          active: form.active,
          isNew: form.isNew,
        },
      });
      if (res.ok) {
        toast.success(form.isNew ? "Code créé." : "Code mis à jour.");
        setForm(emptyForm());
        await load();
      } else {
        toast.error(res.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  const flip = async (r: PromoCodeRow) => {
    const res = await toggle({ data: { code: r.code, active: !r.active } });
    if (res.ok) await load();
    else toast.error(res.message);
  };

  const field = "mt-1 w-full rounded-2xl border border-border bg-background/60 px-3 py-2.5 text-foreground";

  return (
    <section className="pt-5">
      <h2 className="text-[22px] font-semibold tracking-tight">Codes promo</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Réduction en montant fixe (en euros, appliqué puis converti dans la devise du client). Un client ne peut
        utiliser un code qu'une fois.
      </p>

      <div className="mt-4 space-y-3 rounded-3xl border border-border/70 bg-card/50 p-5">
        <p className="text-[15px] font-medium">{form.isNew ? "Nouveau code" : `Modifier ${form.code}`}</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-[11px] text-muted-foreground">
            Code
            <input
              className={field}
              value={form.code}
              disabled={!form.isNew}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="BIENVENUE20"
            />
          </label>
          <label className="text-[11px] text-muted-foreground">
            Réduction (€)
            <input
              className={field}
              type="number"
              min={0}
              step="0.01"
              value={form.discount}
              onChange={(e) => setForm({ ...form, discount: e.target.value })}
            />
          </label>
          <label className="text-[11px] text-muted-foreground">
            Début
            <input className={field} type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
          </label>
          <label className="text-[11px] text-muted-foreground">
            Fin
            <input className={field} type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
          </label>
          <label className="text-[11px] text-muted-foreground">
            Utilisations max (vide = illimité)
            <input className={field} type="number" min={1} value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} />
          </label>
          <label className="flex items-end gap-2 pb-3 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Actif
          </label>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
          >
            {form.isNew ? "Créer le code" : "Enregistrer"}
          </button>
          {!form.isNew && (
            <button type="button" onClick={() => setForm(emptyForm())} className="rounded-full bg-secondary px-5 py-2.5 text-sm">
              Annuler
            </button>
          )}
        </div>
      </div>

      <ul className="mt-4 space-y-3">
        {rows.map((r) => (
          <li key={r.code} className="rounded-3xl border border-border/70 bg-card/50 p-5">
            <div className="flex items-center gap-3">
              <div className="min-w-0">
                <p className="truncate text-[17px] font-medium">{r.code}</p>
                <p className="text-xs text-muted-foreground">
                  −{r.discount_eur.toFixed(2)} € · utilisé {r.used_count} fois
                  {r.max_uses !== null ? ` / ${r.max_uses}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.starts_at).toLocaleDateString("fr-FR")} → {new Date(r.ends_at).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <div className="ml-auto flex shrink-0 gap-2">
                <button type="button" onClick={() => edit(r)} className="rounded-full bg-secondary px-3 py-2 text-xs">
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() => void flip(r)}
                  className={`rounded-full px-3 py-2 text-xs ${r.active ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
                >
                  {r.active ? "Actif" : "Inactif"}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
