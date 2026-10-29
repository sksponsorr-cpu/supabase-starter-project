import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Users, Copy } from "lucide-react";
import { askExpertMarketing } from "@/lib/expert-marketing.functions";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/expert-marketing")({
  head: () => ({ meta: [{ title: "Expert marketing — Sam flash 2.0" }] }),
  component: ExpertMarketingPage,
});

const field = "w-full rounded-2xl border border-border bg-card p-3 text-sm outline-none";
const NETWORKS = ["Facebook", "Instagram", "TikTok", "WhatsApp", "YouTube", "Autre"] as const;

function ExpertMarketingPage() {
  const ask = useServerFn(askExpertMarketing);
  const [sector, setSector] = useState("");
  const [product, setProduct] = useState("");
  const [price, setPrice] = useState("");
  const [audience, setAudience] = useState("");
  const [objective, setObjective] = useState("");
  const [network, setNetwork] = useState<(typeof NETWORKS)[number]>("Instagram");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setAnswer(null);
    try {
      const res = await ask({ data: { sector, product, price, audience, objective, network, language: "français" } });
      if (res.ok) setAnswer(res.text);
      else toast.error(res.message);
    } catch {
      toast.error("L'expert n'a pas pu répondre. Réessaie dans un instant.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!answer) return;
    try {
      await navigator.clipboard.writeText(answer);
      toast.success("Texte copié.");
    } catch {
      toast.error("Copie impossible. Sélectionne le texte et copie-le.");
    }
  };

  return (
    <main className="mx-auto max-w-md space-y-6 px-5 py-8 text-foreground">
      <header className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary"><Users className="h-6 w-6" /></div>
        <h1 className="text-xl font-bold">Expert marketing</h1>
      </header>

      <div className="space-y-3">
        <input className={field} placeholder="Ton secteur (ex. mode, alimentation)" maxLength={120} value={sector} onChange={(e) => setSector(e.target.value)} />
        <input className={field} placeholder="Ton produit ou service" maxLength={200} value={product} onChange={(e) => setProduct(e.target.value)} />
        <input className={field} placeholder="Prix (optionnel)" maxLength={60} value={price} onChange={(e) => setPrice(e.target.value)} />
        <input className={field} placeholder="Public cible (ex. jeunes à Lubumbashi)" maxLength={200} value={audience} onChange={(e) => setAudience(e.target.value)} />
        <input className={field} placeholder="Objectif (ex. vendre, faire connaître)" maxLength={200} value={objective} onChange={(e) => setObjective(e.target.value)} />
        <label className="block text-sm font-semibold">
          Réseau social
          <select className={`${field} mt-2`} value={network} onChange={(e) => setNetwork(e.target.value as (typeof NETWORKS)[number])}>
            {NETWORKS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <button type="button" disabled={busy} onClick={() => void submit()} className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">
          {busy ? "L'expert rédige…" : "Demander à l'expert"}
        </button>
      </div>

      {answer && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Réponse de l'expert</h2>
            <button type="button" onClick={() => void copy()} className="flex items-center gap-1 text-sm font-semibold text-primary">
              <Copy className="h-4 w-4" /> Copier
            </button>
          </div>
          <div className="whitespace-pre-wrap rounded-2xl bg-card p-4 text-sm leading-relaxed">{answer}</div>
        </section>
      )}

      <Link to="/vendeur" className="block text-center text-sm font-semibold text-primary">← Retour à Créative AI</Link>
    </main>
  );
}
