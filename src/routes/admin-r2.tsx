import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { adminCheckR2, type R2Check } from "@/lib/r2check.functions";

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
      </main>
    </div>
  );
}
