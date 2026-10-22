import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminMonetizeOverview,
  adminSaveMonetizeSettings,
  adminReviewMonetizeVideo,
  adminResolveWithdrawal,
  type AdminMonetizeOverview,
  type MonetizeSettings,
} from "@/lib/monetize.functions";
import { AFRICA_CODES, countryName, parseCountryCodes } from "@/lib/monetize-countries";
import { toast } from "@/lib/toast";
import { AdminPartnersPanel } from "@/components/samflash/AdminPartnersPanel";

const input = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";
const num = (v: string) => (v.trim() === "" || Number.isNaN(Number(v.replace(",", "."))) ? 0 : Number(v.replace(",", ".")));

/** Bureau admin : réglages Monétise, vérification des vidéos et paiement des retraits. */
export function AdminMonetizePanel() {
  const load = useServerFn(adminMonetizeOverview);
  const save = useServerFn(adminSaveMonetizeSettings);
  const review = useServerFn(adminReviewMonetizeVideo);
  const resolve = useServerFn(adminResolveWithdrawal);

  const [data, setData] = useState<AdminMonetizeOverview | null>(null);
  const [form, setForm] = useState<MonetizeSettings | null>(null);
  const [countries, setCountries] = useState("");
  const [views, setViews] = useState<Record<string, { v: string; e: string; reason: string }>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    load()
      .then((d) => {
        setData(d);
        setForm(d.settings);
        setCountries(d.settings.eligible_countries.join(", "));
      })
      .catch(() => toast.error("Chargement impossible."));
  }, [load]);

  useEffect(() => refresh(), [refresh]);

  const act = async (fn: () => Promise<{ ok: boolean; message: string }>) => {
    setBusy(true);
    try {
      const r = await fn();
      (r.ok ? toast.success : toast.error)(r.message);
      if (r.ok) refresh();
    } catch {
      toast.error("Erreur, réessayez.");
    } finally {
      setBusy(false);
    }
  };

  if (!data || !form) return <p className="text-sm text-muted-foreground animate-pulse">Chargement...</p>;
  const set = <K extends keyof MonetizeSettings>(k: K, v: MonetizeSettings[K]) => setForm({ ...form, [k]: v });
  const codes = parseCountryCodes(countries);

  const [view, setView] = useState<"partners" | "creators" | "settings">("partners");

  return (
    <div className="space-y-5">
      <div className="inline-flex gap-1 rounded-full border border-border bg-card/50 p-1">
        {(
          [
            { id: "partners", label: "Partenaires" },
            { id: "creators", label: "Créateurs" },
            { id: "settings", label: "Réglages" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setView(t.id)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-all duration-500 ease-out ${
              view === t.id ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === "partners" && <AdminPartnersPanel />}
      {view === "settings" && (
      <section className="space-y-3 rounded-2xl border border-border p-4">
        <h3 className="text-base font-semibold">Réglages Monétise</h3>
        <p className="text-xs text-muted-foreground">
          Dépensé ce mois : {data.monthSpent} € / budget {form.monthly_budget_eur} €. Quand le budget est atteint, plus aucune vidéo ne peut être validée.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} /> Programme ouvert
        </label>
        <div className="grid grid-cols-3 gap-2">
          {([["rpm_essai", "RPM Essai (€)"], ["rpm_light", "RPM Light (€)"], ["rpm_pro", "RPM Pro (€)"]] as const).map(([k, label]) => (
            <label key={k} className="text-xs">{label}
              <input className={input} inputMode="decimal" defaultValue={form[k]} onChange={(e) => set(k, num(e.target.value))} />
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">Vues minimum<input className={input} inputMode="numeric" defaultValue={form.min_views} onChange={(e) => set("min_views", Math.round(num(e.target.value)))} /></label>
          <label className="text-xs">Retrait minimum (€)<input className={input} inputMode="decimal" defaultValue={form.min_withdrawal_eur} onChange={(e) => set("min_withdrawal_eur", num(e.target.value))} /></label>
          <label className="text-xs">Jours avant disponibilité<input className={input} inputMode="numeric" defaultValue={form.hold_days} onChange={(e) => set("hold_days", Math.round(num(e.target.value)))} /></label>
          <label className="text-xs">Plafond par créateur / mois (€)<input className={input} inputMode="decimal" defaultValue={form.monthly_creator_cap_eur} onChange={(e) => set("monthly_creator_cap_eur", num(e.target.value))} /></label>
          <label className="col-span-2 text-xs">Budget global / mois (€), 0 = sans limite<input className={input} inputMode="decimal" defaultValue={form.monthly_budget_eur} onChange={(e) => set("monthly_budget_eur", num(e.target.value))} /></label>
        </div>
        <label className="text-xs">Moyens de retrait affichés<input className={input} value={form.withdrawal_methods} onChange={(e) => set("withdrawal_methods", e.target.value)} /></label>
        <div className="space-y-1.5">
          <p className="text-xs">Pays éligibles (codes à 2 lettres : SN, CI, FR, US…)</p>
          <textarea className={input} rows={3} value={countries} onChange={(e) => setCountries(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-full border border-border px-3 py-1.5 text-xs" onClick={() => setCountries(parseCountryCodes([...codes, ...AFRICA_CODES].join(",")).join(", "))}>Ajouter tous les pays africains</button>
            <button type="button" className="rounded-full border border-border px-3 py-1.5 text-xs" onClick={() => setCountries(parseCountryCodes([...codes, "FR", "US"].join(",")).join(", "))}>Ajouter France + États-Unis</button>
          </div>
          <p className="text-xs text-muted-foreground">{codes.length} pays : {codes.slice(0, 8).map(countryName).join(", ")}{codes.length > 8 ? "…" : ""}</p>
        </div>
        <label className="text-xs">Mots qui identifient une vidéo Sam Flash (séparés par des virgules)<input className={input} value={form.mention_keywords} onChange={(e) => set("mention_keywords", e.target.value)} /></label>
        <label className="text-xs">Règles affichées aux créateurs (une règle par ligne)
          <textarea className={input} rows={6} value={form.rules} onChange={(e) => set("rules", e.target.value)} />
        </label>
        <button disabled={busy} className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          onClick={() => void act(() => save({ data: { ...form, eligible_countries: codes } }))}>
          Enregistrer les réglages
        </button>
      </section>
      )}

      {view === "creators" && (
      <section className="space-y-3 rounded-2xl border border-border p-4">
        <h3 className="text-base font-semibold">Vidéos à vérifier ({data.pendingVideos.length})</h3>
        <p className="text-xs text-muted-foreground">Ouvrez le lien, regardez les vues réelles et la mention de Sam Flash, puis saisissez les vues vérifiées et éligibles.</p>
        {data.pendingVideos.length === 0 && <p className="text-sm text-muted-foreground">Rien en attente.</p>}
        {data.pendingVideos.map((v) => {
          const ai = v as { ai_views?: number | null; ai_confidence?: number | null; ai_note?: string | null };
          // Pré-remplit avec la lecture IA quand elle existe ; l'administrateur peut toujours corriger.
          const suggested = ai.ai_views ?? v.claimed_views;
          const f = views[v.id] ?? { v: String(suggested), e: String(suggested), reason: "" };
          const lowConfidence = ai.ai_views == null || (ai.ai_confidence ?? 0) < 0.6;
          const upd = (p: Partial<typeof f>) => setViews({ ...views, [v.id]: { ...f, ...p } });
          return (
            <div key={v.id} className="space-y-2 rounded-xl border border-border p-3 text-sm">
              <p className="text-xs text-muted-foreground">{v.user_email ?? v.user_id} · {v.country ? countryName(v.country) : "pays ?"} · offre {v.tier} · {v.claimed_views.toLocaleString("fr-FR")} vues annoncées</p>
              <a href={v.video_url} target="_blank" rel="noreferrer" className="block break-all text-primary underline">{v.video_url}</a>
              {v.screen_record_url && <a href={v.screen_record_url} target="_blank" rel="noreferrer" className="block break-all text-xs underline">Vidéo d'écran</a>}
              <div className={`rounded-lg p-2 text-xs ${lowConfidence ? "bg-amber-500/10 text-amber-300" : "bg-emerald-500/10 text-emerald-300"}`}>
                {ai.ai_views == null
                  ? "Lecture IA : aucun chiffre lu. Vérifiez la capture à la main."
                  : `Lecture IA : ${ai.ai_views.toLocaleString("fr-FR")} vues (confiance ${Math.round((ai.ai_confidence ?? 0) * 100)} %)${lowConfidence ? " : à vérifier à la main" : ""}`}
                {ai.ai_note ? <span className="block opacity-80">{ai.ai_note}</span> : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">Vues vérifiées<input className={input} inputMode="numeric" value={f.v} onChange={(e) => upd({ v: e.target.value.replace(/\D/g, "") })} /></label>
                <label className="text-xs">Vues éligibles<input className={input} inputMode="numeric" value={f.e} onChange={(e) => upd({ e: e.target.value.replace(/\D/g, "") })} /></label>
              </div>
              <input className={input} placeholder="Motif si refus" value={f.reason} onChange={(e) => upd({ reason: e.target.value })} />
              <div className="flex gap-2">
                <button disabled={busy} className="flex-1 rounded-full bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  onClick={() => void act(() => review({ data: { id: v.id, decision: "approve", verifiedViews: Number(f.v || 0), eligibleViews: Number(f.e || 0), reason: "" } }))}>Valider</button>
                <button disabled={busy} className="flex-1 rounded-full border border-border py-2 text-xs font-semibold disabled:opacity-50"
                  onClick={() => void act(() => review({ data: { id: v.id, decision: "reject", verifiedViews: 0, eligibleViews: 0, reason: f.reason } }))}>Refuser</button>
              </div>
            </div>
          );
        })}
      </section>

      <section className="space-y-3 rounded-2xl border border-border p-4">
        <h3 className="text-base font-semibold">Retraits à payer ({data.pendingWithdrawals.length})</h3>
        {data.pendingWithdrawals.length === 0 && <p className="text-sm text-muted-foreground">Aucun retrait en attente.</p>}
        {data.pendingWithdrawals.map((w) => (
          <div key={w.id} className="space-y-2 rounded-xl border border-border p-3 text-sm">
            <p className="font-semibold">{w.amount_eur} € · {countryName(w.country)}</p>
            <p className="text-xs text-muted-foreground">{w.user_email ?? w.user_id} · {w.method}</p>
            <p className="break-all rounded-lg bg-secondary/50 px-2 py-1.5 text-xs select-all">{w.account_details}</p>
            <input className={input} placeholder="Note (référence du paiement, motif de refus)" value={notes[w.id] ?? ""} onChange={(e) => setNotes({ ...notes, [w.id]: e.target.value })} />
            <div className="flex gap-2">
              <button disabled={busy} className="flex-1 rounded-full bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                onClick={() => void act(() => resolve({ data: { id: w.id, status: "paid", note: notes[w.id] ?? "" } }))}>Marquer payé</button>
              <button disabled={busy} className="flex-1 rounded-full border border-border py-2 text-xs font-semibold disabled:opacity-50"
                onClick={() => void act(() => resolve({ data: { id: w.id, status: "rejected", note: notes[w.id] ?? "" } }))}>Refuser</button>
            </div>
          </div>
        ))}
      </section>
      )}

    </div>
  );
}
