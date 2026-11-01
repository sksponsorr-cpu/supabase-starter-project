import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminListResources, adminSaveResource, adminDeleteResource } from "@/lib/resources.admin.functions";

type Row = {
  id: string;
  category: string;
  kind: string;
  title: string;
  summary: string;
  body: string;
  preview: boolean;
  published: boolean;
  source?: string | null;
};

const EMPTY: Omit<Row, "id"> = { category: "prompts", kind: "prompt", title: "", summary: "", body: "", preview: true, published: false };

const CATEGORIES = ["formations", "prompts", "niches", "actu", "skills"];
const KINDS = ["formation", "article", "prompt", "video", "niche", "actu", "skill"];

export function AdminResourcesPanel() {
  const list = useServerFn(adminListResources);
  const save = useServerFn(adminSaveResource);
  const remove = useServerFn(adminDeleteResource);
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState<Omit<Row, "id"> & { id?: string }>(EMPTY);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => setRows((await list()) as Row[]);
  useEffect(() => {
    void load();
  }, []);

  const submit = async () => {
    setMessage(null);
    const res = await save({ data: form as never });
    if (res.ok) {
      setMessage("Enregistré.");
      setForm(EMPTY);
      await load();
    } else {
      setMessage(res.message ?? "Enregistrement impossible.");
    }
  };

  const togglePublish = async (r: Row) => {
    await save({ data: { ...r, published: !r.published } as never });
    await load();
  };

  const onDelete = async (r: Row) => {
    if (!window.confirm(`Supprimer « ${r.title} » ?`)) return;
    await remove({ data: { id: r.id } });
    await load();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 p-4 space-y-3">
        <h2 className="text-lg font-semibold">{form.id ? "Modifier la ressource" : "Nouvelle ressource"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-xl bg-background/60 p-2">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="rounded-xl bg-background/60 p-2">
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Titre" className="w-full rounded-xl bg-background/60 p-2" />
        <input value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="Résumé (visible par tous)" className="w-full rounded-xl bg-background/60 p-2" />
        <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={8} placeholder="Contenu complet (abonnés)" className="w-full rounded-xl bg-background/60 p-2" />
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.preview} onChange={(e) => setForm({ ...form, preview: e.target.checked })} /> Aperçu pour tous</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> Publié</label>
        </div>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
        <div className="flex gap-2">
          <button onClick={submit} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Enregistrer</button>
          {form.id && <button onClick={() => setForm(EMPTY)} className="rounded-full border border-white/15 px-4 py-2 text-sm">Annuler</button>}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Toutes les ressources</h2>
        {rows.map((r) => (
          <article key={r.id} className="rounded-2xl border border-white/10 p-4">
            <p className="text-xs uppercase text-muted-foreground">{r.category} · {r.kind} · {r.published ? "Publié" : "Brouillon"}</p>
            <h3 className="mt-1 font-semibold">{r.title}</h3>
            {r.source && <p className="text-xs text-muted-foreground">Source : {r.source}</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <button onClick={() => togglePublish(r)} className="rounded-full border border-white/15 px-3 py-1">{r.published ? "Dépublier" : "Publier"}</button>
              <button onClick={() => setForm({ ...r })} className="rounded-full border border-white/15 px-3 py-1">Modifier</button>
              <button onClick={() => onDelete(r)} className="rounded-full border border-red-500/40 px-3 py-1 text-red-400">Supprimer</button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
