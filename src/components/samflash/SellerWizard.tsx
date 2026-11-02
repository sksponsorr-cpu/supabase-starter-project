import { useState, type ChangeEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check } from "lucide-react";
import { saveShop } from "@/lib/shop.functions";
import { presignAiUpload } from "@/lib/ai-tools.functions";
import { CATEGORIES, field, uploadImage } from "./shared";

const STEPS = ["Identité", "Présentation", "Contact", "Vérification"] as const;

type Draft = {
  name: string;
  category: string;
  description: string;
  logoUrl: string | null;
  phone: string;
  country: string;
  address: string;
};

/** Création de la boutique en 4 étapes. Chaque étape valide ses champs avant de continuer. */
export function SellerWizard({ onDone }: { onDone: () => void }) {
  const save = useServerFn(saveShop);
  const presign = useServerFn(presignAiUpload);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({
    name: "",
    category: "",
    description: "",
    logoUrl: null,
    phone: "",
    country: "",
    address: "",
  });

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const valid = [
    draft.name.trim().length >= 2 && draft.category !== "",
    true,
    draft.phone.trim().length >= 6 && draft.country.trim().length >= 2,
    true,
  ][step];

  const onLogo = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      set({ logoUrl: await uploadImage(file, presign) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import impossible.");
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await save({
        data: {
          name: draft.name,
          category: draft.category,
          description: draft.description,
          phone: draft.phone,
          country: draft.country,
          address: draft.address,
          logoUrl: draft.logoUrl,
        },
      });
      if (!r.ok) throw new Error(r.message);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "La boutique n'a pas pu être créée.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="text-2xl font-black text-slate-900">Crée ta boutique</h1>
        <p className="mt-1 text-sm text-slate-500">Quelques étapes suffisent. Tu pourras tout modifier ensuite.</p>
      </header>

      <ol className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i <= step ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-400"}`}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={`hidden text-xs font-semibold sm:inline ${i <= step ? "text-slate-900" : "text-slate-400"}`}>{label}</span>
          </li>
        ))}
      </ol>

      <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6">
        {step === 0 && (
          <>
            <label className="block text-sm font-semibold text-slate-900">
              Nom de ta boutique
              <input className={`${field} mt-1`} value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} placeholder="Ex : Boutique Awa" />
            </label>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-900">Catégorie principale</p>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set({ category: c })}
                    className={`rounded-2xl border p-3 text-left text-sm font-medium ${draft.category === c ? "border-blue-700 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-700"}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <label className="block text-sm font-semibold text-slate-900">
              Description
              <textarea className={`${field} mt-1`} rows={4} maxLength={800} value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="Ce que tu vends, pour qui, pourquoi les clients te choisissent." />
            </label>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-900">Logo (facultatif)</p>
              <div className="flex items-center gap-4">
                {draft.logoUrl ? (
                  <img src={draft.logoUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-xs text-slate-400">Aucun</span>
                )}
                <input type="file" accept="image/*" onChange={onLogo} className="text-sm" />
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <label className="block text-sm font-semibold text-slate-900">
              Téléphone (WhatsApp)
              <input className={`${field} mt-1`} value={draft.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+237 6XX XXX XXX" maxLength={40} />
            </label>
            <label className="block text-sm font-semibold text-slate-900">
              Pays et ville
              <input className={`${field} mt-1`} value={draft.country} onChange={(e) => set({ country: e.target.value })} placeholder="Ex : Cameroun, Douala" maxLength={80} />
            </label>
            <label className="block text-sm font-semibold text-slate-900">
              Adresse de la boutique ou du retrait (facultatif)
              <input className={`${field} mt-1`} value={draft.address} onChange={(e) => set({ address: e.target.value })} maxLength={200} />
            </label>
          </>
        )}

        {step === 3 && (
          <dl className="space-y-3 text-sm">
            <Row label="Nom" value={draft.name} />
            <Row label="Catégorie" value={draft.category} />
            <Row label="Description" value={draft.description || "—"} />
            <Row label="Téléphone" value={draft.phone} />
            <Row label="Pays et ville" value={draft.country} />
            <Row label="Adresse" value={draft.address || "—"} />
          </dl>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="flex items-center justify-between">
        <button type="button" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)} className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-40">
          Retour
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" disabled={!valid} onClick={() => setStep((s) => s + 1)} className="rounded-full bg-blue-700 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-40">
            Continuer
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={submit} className="rounded-full bg-blue-700 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-40">
            {busy ? "Création…" : "Créer ma boutique"}
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}
