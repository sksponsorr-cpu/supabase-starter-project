import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitMemberResource, requestUpload } from "@/lib/resources.members.functions";

const CATEGORIES = [
  { id: "formations", label: "Formation" },
  { id: "prompts", label: "Prompt" },
  { id: "niches", label: "Niche virale" },
  { id: "actu", label: "Actualité" },
  { id: "skills", label: "Compétence" },
];

/** Formulaire de publication d'un membre. La publication attend la validation de l'administrateur. */
export function MemberPublishForm({ onDone }: { onDone: () => void }) {
  const submit = useServerFn(submitMemberResource);
  const upload = useServerFn(requestUpload);
  const [category, setCategory] = useState("prompts");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onSend = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const kind = category === "prompts" ? "prompt" : category === "niches" ? "niche" : category === "skills" ? "skill" : category === "actu" ? "article" : "formation";
      const r = await submit({ data: { category, kind, title, summary, body } });
      if (!r.ok || !r.id) throw new Error("Publication impossible : vérifiez que le SQL des publications a bien été exécuté.");
      for (const f of files) {
        const u = await upload({ data: { resourceId: r.id, name: f.name, mime: f.type, size: f.size } });
        if (!u.ok) throw new Error(u.message);
        const put = await fetch(u.uploadUrl, { method: "PUT", headers: { "Content-Type": f.type }, body: f });
        if (!put.ok) throw new Error(`Envoi de « ${f.name} » impossible.`);
      }
      setMessage("Merci ! Votre publication sera visible après validation.");
      setTitle("");
      setSummary("");
      setBody("");
      setFiles([]);
      onDone();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Publication impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-white/10 p-4">
      <h2 className="text-lg font-semibold">Publier une ressource</h2>
      <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl bg-background/60 p-2">
        {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Titre" className="w-full rounded-xl bg-background/60 p-2" />
      <input value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={300} placeholder="Résumé (visible par tous)" className="w-full rounded-xl bg-background/60 p-2" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={20000} placeholder="Contenu complet (abonnés)" className="w-full rounded-xl bg-background/60 p-2" />
      <input
        type="file"
        multiple
        accept="image/*,application/pdf,video/mp4,video/webm,text/plain,text/markdown,application/json,application/zip,.md,.txt,.json,.zip,.doc,.docx,.xlsx"
        onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))}
        className="text-sm"
      />
      {files.length > 0 && <p className="text-xs text-muted-foreground">{files.length} fichier(s) joint(s)</p>}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      <button
        disabled={busy || title.trim().length < 3 || summary.trim().length < 5}
        onClick={onSend}
        className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Envoi…" : "Envoyer pour validation"}
      </button>
    </section>
  );
}
