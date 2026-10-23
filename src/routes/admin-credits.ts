import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminFindUserByEmail, adminAddCredits, adminGrantCustomPlan } from "@/lib/admin-credits.functions";

export const Route = createFileRoute("/admin-credits")({
  component: AdminCreditsPage,
});

const field = "w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition-all duration-300 focus:border-primary/60";
const btn = "rounded-full px-5 py-3 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-40";

/** Bureau admin : ajouter des crédits libres (+5, +10, +20...) ou un abonnement « Sur mesure ». */
function AdminCreditsPage() {
  const findUser = useServerFn(adminFindUserByEmail);
  const addCredits = useServerFn(adminAddCredits);
  const grantCustom = useServerFn(adminGrantCustomPlan);

  const [email, setEmail] = useState("");
  const [user, setUser] = useState<{ id: string; email: string; name: string | null } | null>(null);
  const [mode, setMode] = useState<"credits" | "custom">("credits");
  const [credits, setCredits] = useState("10");
  const [months, setMonths] = useState("1");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fn();
      setNotice(res.message ?? (res.ok ? "Terminé." : "Échec."));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  };

  const onFind = () =>
    run(async () => {
      setUser(null);
      const res = await findUser({ data: { email } });
      if (res.ok) {
        setUser(res.user);
        return { ok: true, message: `Compte trouvé : ${res.user.email}` };
      }
      return res;
    });

  const nCredits = Number.parseInt(credits, 10);
  const valid = user && Number.isInteger(nCredits) && nCredits > 0 && reason.trim().length >= 3;

  const onSubmit = () => {
    if (!user || !valid) return;
    if (!window.confirm(`Confirmer : ${mode === "custom" ? "Sur mesure" : "+"}${nCredits} crédits pour ${user.email} ?`)) return;
    void run(() =>
      mode === "credits"
        ? addCredits({ data: { userId: user.id, credits: nCredits, reason } })
        : grantCustom({ data: { userId: user.id, credits: nCredits, months: Number.parseInt(months, 10) || 1, reason } }),
    );
  };

  return (
    <main className="mx-auto min-h-screen max-w-xl space-y-5 bg-background px-5 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Crédits & abonnements manuels</h1>
        <p className="text-xs text-muted-foreground">Réservé aux administrateurs.</p>
      </header>

      {notice && <p className="rounded-2xl bg-primary/10 px-4 py-3 text-sm">{notice}</p>}

      <section className="space-y-3 rounded-3xl border border-border bg-card/50 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">1. Utilisateur</p>
        <input className={field} type="email" placeholder="E-mail de l'utilisateur" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="button" className={`${btn} bg-secondary`} disabled={busy || !email.includes("@")} onClick={() => void onFind()}>
          Rechercher
        </button>
        {user && <p className="text-sm">✓ {user.email}{user.name ? ` — ${user.name}` : ""}</p>}
      </section>

      {user && (
        <section className="space-y-3 rounded-3xl border border-border bg-card/50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">2. Que voulez-vous ajouter ?</p>
          <div className="flex gap-2">
            <button type="button" className={`${btn} ${mode === "credits" ? "bg-primary text-primary-foreground" : "bg-secondary"}`} onClick={() => setMode("credits")}>
              Ajouter des crédits
            </button>
            <button type="button" className={`${btn} ${mode === "custom" ? "bg-primary text-primary-foreground" : "bg-secondary"}`} onClick={() => setMode("custom")}>
              Abonnement sur mesure
            </button>
          </div>

          <label className="text-xs text-muted-foreground">Nombre de crédits</label>
          <input className={field} type="number" min={1} inputMode="numeric" value={credits} onChange={(e) => setCredits(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {[5, 10, 20, 50, 100].map((n) => (
              <button key={n} type="button" className={`${btn} bg-secondary !px-4 !py-2`} onClick={() => setCredits(String(n))}>
                +{n}
              </button>
            ))}
          </div>

          {mode === "custom" && (
            <>
              <label className="text-xs text-muted-foreground">Durée (en mois)</label>
              <input className={field} type="number" min={1} max={24} inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} />
            </>
          )}

          <input className={field} placeholder="Motif (obligatoire)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button type="button" className={`${btn} w-full bg-primary text-primary-foreground`} disabled={busy || !valid} onClick={onSubmit}>
            {busy ? "En cours…" : mode === "credits" ? `Ajouter ${Number.isInteger(nCredits) ? nCredits : ""} crédits` : "Activer le sur mesure"}
          </button>
        </section>
      )}

      <div className="text-center">
        <Link to="/admin" className="text-xs text-muted-foreground underline underline-offset-4">← Retour à l'administration</Link>
      </div>
    </main>
  );
}
