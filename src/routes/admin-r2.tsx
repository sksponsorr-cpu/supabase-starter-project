import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { adminCheckR2, type R2Check } from "@/lib/r2check.functions";
import { adminMigrateToR2 } from "@/lib/r2migrate.functions";

export const Route = createFileRoute("/admin-r2")({
  head: () => ({ meta: [{ title: "Test Cloudflare R2 – Sam Flash 2.0" }] }),
  component: AdminR2Page,
});

function AdminR2Page() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const run = useServerFn(adminCheckR2);
  const [checks, setChecks] = useState<R2Check[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const migrate = useServerFn(adminMigrateToR2);
  const [migBusy, setMigBusy] = useState(false);
  const [migDone, setMigDone] = useState(0);
  const [migLeft, setMigLeft] = useState<number | null>(null);
  const [migFailed, setMigFailed] = useState<{ path: string; reason: string }[]>([]);
  const [migMsg, setMigMsg] = useState("");

  const startMigration = async () => {
    setMigBusy(true);
    setMigMsg("");
    setMigDone(0);
    setMigFailed([]);
    const skip: string[] = [];
    let total = 0;
    try {
      for (let i = 0; i < 2000; i++) {
        const r = await migrate({ data: { limit: 2, skipPaths: skip } });
        total += r.migrated;
        setMigDone(total);
        setMigLeft(r.remaining);
        for (const f of r.failed) {
          skip.push(f.path);
          setMigFailed((prev) => [...prev, f]);
        }
        if (r.migrated === 0) break;
      }
      setMigMsg("Terminé. Les fichiers d'origine restent dans Supabase tant que vous ne les supprimez pas.");
    } catch (e: any) {
      setMigMsg(String(e?.message ?? "").includes("refusé") ? "Accès réservé aux administrateurs." : "Interrompu : relancez pour continuer là où ça s'est arrêté.");
    } finally {
      setMigBusy(false);
    }
  };

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/" });
  }, [loading, session, navigate]);

  const start = async () => {
    setBusy(true);
    setError("");
    setChecks(null);
    try {
      setChecks(await run());
    } catch (e: any) {
      setError(String(e?.message ?? "").includes("refusé") ? "Accès réservé aux administrateurs." : "Le test a échoué, réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const allOk = checks && checks.every((c) => c.ok);

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-hero)" }}>
      <header className="sticky top-0 z-10 border-b border-border/40 bg-background/70 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <Link to="/admin" aria-label="Retour" className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold tracking-tight">Test Cloudflare R2</h1>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          Ce test envoie un petit fichier sur votre bucket puis essaie de le lire par l'adresse publique, exactement comme le fait le site pour vos vidéos.
        </p>

        <button
          onClick={() => void start()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-[15px] font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {busy ? "Test en cours…" : "Lancer le test"}
        </button>

        {error && <p className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}

        {checks && (
          <>
            <div
              className={`rounded-2xl p-4 text-sm font-medium ${allOk ? "bg-green-500/15 text-green-500" : "bg-destructive/10 text-destructive"}`}
            >
              {allOk ? "Tout fonctionne : vos vidéos seront stockées sur R2." : "Un point est à corriger (voir ci-dessous)."}
            </div>
            <div className="space-y-2.5">
              {checks.map((c) => (
                <div key={c.label} className="rounded-2xl border border-border/60 bg-card/50 p-4">
                  <p className="flex items-center gap-2 font-medium">
                    {c.ok ? <CheckCircle2 className="h-4.5 w-4.5 text-green-500" /> : <XCircle className="h-4.5 w-4.5 text-destructive" />}
                    {c.label}
                  </p>
                  <p className="mt-1.5 break-words text-sm text-muted-foreground">{c.detail}</p>
                </div>
              ))}
            </div>
          </>
        )}

        <section className="space-y-3 rounded-2xl border border-border/60 bg-card/50 p-4">
          <h2 className="font-semibold">Migrer les anciennes vidéos vers R2</h2>
          <p className="text-sm text-muted-foreground">
            Copie les anciens fichiers de Supabase vers Cloudflare R2 pour réduire la consommation (egress) de Supabase. Lancez d'abord le test ci-dessus : tout doit être vert. Gardez cette page ouverte jusqu'à la fin.
          </p>
          <button
            onClick={() => void startMigration()}
            disabled={migBusy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-[15px] font-semibold text-primary-foreground disabled:opacity-60"
          >
            {migBusy && <Loader2 className="h-4 w-4 animate-spin" />} {migBusy ? "Migration en cours…" : "Lancer la migration"}
          </button>
          {(migBusy || migDone > 0 || migLeft !== null) && (
            <p className="text-sm">
              Migrés : {migDone}{migLeft !== null ? ` · Restants : ${migLeft}` : ""}
            </p>
          )}
          {migMsg && <p className="text-sm text-muted-foreground">{migMsg}</p>}
          {migFailed.length > 0 && (
            <div className="space-y-1 text-xs text-destructive">
              {migFailed.slice(0, 10).map((f) => (
                <p key={f.path} className="break-words">{f.path} : {f.reason}</p>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
