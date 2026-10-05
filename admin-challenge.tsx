import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  adminListSubmissions,
  adminAnalyzeSubmission,
  adminReviewSubmission,
  adminListDemos,
  adminSaveDemo,
  adminUpdateDemo,
  CHALLENGE_WINDOW_DAYS,
  type AdminSubmission,
  type PromoDemo,
} from "@/lib/challenge.functions";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/admin-challenge")({
  head: () => ({ meta: [{ title: "Admin Challenge – Sam Flash 2.0" }] }),
  component: AdminChallengePage,
});

type Tab = "pending" | "approved" | "rejected";
const TAB_LABEL: Record<Tab, string> = { pending: "En attente", approved: "Acceptées", rejected: "Refusées" };

function AdminChallengePage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const list = useServerFn(adminListSubmissions);
  const analyze = useServerFn(adminAnalyzeSubmission);
  const review = useServerFn(adminReviewSubmission);
  const listDemosFn = useServerFn(adminListDemos);
  const saveDemo = useServerFn(adminSaveDemo);
  const updateDemo = useServerFn(adminUpdateDemo);

  const [tab, setTab] = useState<Tab>("pending");
  const [items, setItems] = useState<AdminSubmission[]>([]);
  const [demos, setDemos] = useState<PromoDemo[]>([]);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/" });
  }, [loading, session, navigate]);

  const load = useCallback(async () => {
    try {
      const [rows, d] = await Promise.all([list({ data: { status: tab } }), listDemosFn()]);
      setItems(rows);
      setDemos(d);
      setDenied(false);
    } catch {
      setDenied(true);
    }
  }, [list, listDemosFn, tab]);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  const runAnalysis = async (id: string) => {
    setBusy(id);
    try {
      const res = await analyze({ data: { id } });
      if (!res.ok) toast.error(res.message);
      else void load();
    } finally {
      setBusy(null);
    }
  };

  const approve = async (s: AdminSubmission) => {
    if (!window.confirm(`Accepter cette demande ? ${s.user_email ?? "L'utilisateur"} recevra 1 mois d'abonnement offert.`)) return;
    setBusy(s.id);
    try {
      const res = await review({ data: { id: s.id, decision: "approve" } });
      res.ok ? toast.success(res.message) : toast.error(res.message);
      void load();
    } finally {
      setBusy(null);
    }
  };

  const reject = async (s: AdminSubmission) => {
    const reason = window.prompt("Motif du refus (visible par l'utilisateur) :", "Preuves non conformes");
    if (reason === null) return;
    setBusy(s.id);
    try {
      const res = await review({ data: { id: s.id, decision: "reject", reason } });
      res.ok ? toast.success(res.message) : toast.error(res.message);
      void load();
    } finally {
      setBusy(null);
    }
  };

  const addDemo = async () => {
    if (!title || !url) {
      toast.error("Titre et lien de la vidéo requis.");
      return;
    }
    const res = await saveDemo({ data: { title, description: desc, videoUrl: url } }).catch(() => ({ ok: false }));
    if (res.ok) {
      toast.success("Vidéo ajoutée.");
      setTitle("");
      setDesc("");
      setUrl("");
      void load();
    } else toast.error("Ajout impossible (vérifiez le lien).");
  };

  const field = "w-full rounded-xl bg-secondary/50 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring";

  if (denied) {
    return <div className="p-6 text-sm text-muted-foreground">Accès réservé aux administrateurs.</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2 max-w-3xl mx-auto">
          <ShieldCheck className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-base font-semibold">Admin · Challenge Promo</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex gap-2">
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === t ? "bg-primary text-primary-foreground" : "bg-secondary/60"}`}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>

        {items.length === 0 && <p className="text-sm text-muted-foreground">Aucune demande.</p>}

        {items.map((s) => (
          <article key={s.id} className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{s.user_email ?? s.user_id}</p>
                <p className="text-xs text-muted-foreground">
                  {s.platform} · publié le {new Date(s.published_at).toLocaleDateString("fr-FR")} · envoyé le{" "}
                  {new Date(s.created_at).toLocaleDateString("fr-FR")}
                </p>
                {s.demo_title && <p className="text-xs text-muted-foreground">Démo : {s.demo_title}</p>}
              </div>
              <a href={s.video_url} target="_blank" rel="noopener noreferrer" className="shrink-0 inline-flex items-center gap-1 text-xs text-primary">
                Voir la vidéo <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <p className="text-sm">
              Vues déclarées : <b>{s.claimed_views.toLocaleString("fr-FR")}</b> en {CHALLENGE_WINDOW_DAYS} jours max
            </p>

            <div className="grid grid-cols-2 gap-2">
              {[{ label: "Vidéo", src: s.screenshot_url }, { label: "Statistiques", src: s.stats_url }].map((img) => (
                <a key={img.label} href={img.src ?? "#"} target="_blank" rel="noopener noreferrer" className="block">
                  <p className="text-xs text-muted-foreground mb-1">{img.label}</p>
                  {img.src ? (
                    <img src={img.src} alt={img.label} className="w-full max-h-64 object-contain rounded-lg bg-secondary/40" />
                  ) : (
                    <div className="h-24 rounded-lg bg-secondary/40" />
                  )}
                </a>
              ))}
            </div>

            {s.ai_verdict && (
              <div className={`rounded-xl px-3 py-2 text-sm space-y-1 ${s.ai_verdict.suspicious ? "bg-destructive/10" : "bg-secondary/50"}`}>
                <p className="font-medium">
                  Avis IA (indicatif) : {s.ai_verdict.suspicious ? "à vérifier" : "rien d'anormal détecté"}
                </p>
                <p className="text-xs">
                  Vues lues sur la capture :{" "}
                  {s.ai_verdict.views_visible !== null ? s.ai_verdict.views_visible.toLocaleString("fr-FR") : "illisible"}
                  {s.ai_verdict.matches_claim === false && " · ne correspond pas à la déclaration"}
                </p>
                <p className="text-xs">{s.ai_verdict.summary}</p>
                {s.ai_verdict.signs.length > 0 && (
                  <ul className="text-xs list-disc pl-4">
                    {s.ai_verdict.signs.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {s.status === "rejected" && s.reject_reason && (
              <p className="text-xs text-destructive">Motif : {s.reject_reason}</p>
            )}

            {s.status === "pending" && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void runAnalysis(s.id)}
                  disabled={busy === s.id}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <Sparkles className="w-4 h-4" /> {busy === s.id ? "Analyse..." : "Analyser (IA)"}
                </button>
                <button
                  onClick={() => void approve(s)}
                  disabled={busy === s.id}
                  className="flex-1 rounded-xl bg-green-600 px-3 py-2 text-sm font-medium text-white"
                >
                  Accepter
                </button>
                <button
                  onClick={() => void reject(s)}
                  disabled={busy === s.id}
                  className="flex-1 rounded-xl bg-destructive px-3 py-2 text-sm font-medium text-white"
                >
                  Refuser
                </button>
              </div>
            )}
          </article>
        ))}

        <section className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
          <h2 className="font-semibold">Vidéos de démo</h2>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" className={field} />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (facultatif)" className={field} />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Lien de la vidéo (Cloudflare, https://...)" className={field} inputMode="url" />
          <button onClick={() => void addDemo()} className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
            Ajouter la vidéo
          </button>

          {demos.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 rounded-xl bg-secondary/40 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{d.title}</p>
                <p className="text-xs text-muted-foreground truncate">{d.video_url}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={async () => {
                    await updateDemo({ data: { id: d.id, active: !d.active } });
                    void load();
                  }}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs"
                >
                  {d.active ? "Masquer" : "Afficher"}
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm("Supprimer cette vidéo ?")) return;
                    await updateDemo({ data: { id: d.id, remove: true } });
                    void load();
                  }}
                  className="p-1.5 text-destructive"
                  aria-label="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
