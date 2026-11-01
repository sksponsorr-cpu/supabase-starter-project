import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminPushStats, adminSendPush } from "@/lib/push.admin.functions";

/** Messages prêts à envoyer : pour inviter les utilisateurs à activer les notifications et à agir. */
const TEMPLATES = [
  {
    label: "Activer les notifications",
    title: "Ne manquez rien",
    body: "Activez les notifications pour savoir quand votre vidéo est prête, et recevoir vos crédits du jour.",
    url: "/app",
  },
  {
    label: "Vos crédits du jour",
    title: "Vos crédits sont renouvelés",
    body: "Vous avez 10 crédits aujourd'hui. Créez votre vidéo maintenant, avant que la file se remplisse.",
    url: "/app",
  },
  {
    label: "Découvrir les offres",
    title: "Passez à l'étape suivante",
    body: "Choisissez l'offre qui vous convient et créez davantage de vidéos chaque mois.",
    url: "/abonnements",
  },
  {
    label: "Ressources",
    title: "Nouvelles ressources",
    body: "Des formations, des prompts et les dernières tendances des niches virales sont en ligne.",
    url: "/ressources",
  },
];

export function AdminPushPanel() {
  const stats = useServerFn(adminPushStats);
  const send = useServerFn(adminSendPush);
  const [data, setData] = useState<{ devices: number; usersWithPush: number; totalUsers: number; vapidReady: boolean } | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/app");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => setData(await stats());
  useEffect(() => {
    void load();
  }, []);

  const pct = data && data.totalUsers > 0 ? Math.round((data.usersWithPush / data.totalUsers) * 100) : 0;

  const onSend = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const r = await send({ data: { title, body, url } });
      if (r.skipped) setMessage("Envoi impossible : les clés VAPID ne sont pas configurées sur le serveur.");
      else setMessage(`Envoyé à ${r.sent} appareil(s).`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 p-4">
          <p className="text-xs uppercase text-muted-foreground">Utilisateurs avec notifications</p>
          <p className="mt-1 text-2xl font-bold">{data?.usersWithPush ?? "…"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 p-4">
          <p className="text-xs uppercase text-muted-foreground">Appareils</p>
          <p className="mt-1 text-2xl font-bold">{data?.devices ?? "…"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 p-4">
          <p className="text-xs uppercase text-muted-foreground">Part des inscrits</p>
          <p className="mt-1 text-2xl font-bold">{pct}%</p>
        </div>
      </section>
      {data && !data.vapidReady && (
        <p className="text-sm text-amber-400">Les clés VAPID ne sont pas configurées : les envois ne partiront pas.</p>
      )}

      <section className="space-y-3 rounded-2xl border border-white/10 p-4">
        <h2 className="text-lg font-semibold">Envoyer une notification</h2>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              onClick={() => {
                setTitle(t.title);
                setBody(t.body);
                setUrl(t.url);
              }}
              className="rounded-full border border-white/15 px-3 py-1 text-sm"
            >
              {t.label}
            </button>
          ))}
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" className="w-full rounded-xl bg-background/60 p-2" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Message" className="w-full rounded-xl bg-background/60 p-2" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Page ouverte au clic (ex. /app)" className="w-full rounded-xl bg-background/60 p-2" />
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
        <button
          disabled={busy || title.length < 3 || body.length < 5}
          onClick={() => {
            if (window.confirm(`Envoyer « ${title} » à ${data?.devices ?? 0} appareil(s) ?`)) void onSend();
          }}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Envoi…" : "Envoyer à tous"}
        </button>
      </section>
    </div>
  );
}
