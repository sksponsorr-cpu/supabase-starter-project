import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Wrench } from "lucide-react";
import { getMaintenance, type MaintenanceState } from "@/lib/maintenance.functions";
import { getAdminAccess } from "@/lib/admin.functions";
import { isOwnerEmail } from "@/lib/owners";
import { useAuth } from "@/hooks/useAuth";

const DEFAULT_MESSAGE =
  "Nous améliorons Sam flash. Le service sera de retour dans quelques instants.";

/**
 * Affiche la page de maintenance à tous les utilisateurs quand l'administrateur
 * l'a activée. Restent accessibles : la page de connexion (/) et /admin, pour que
 * l'équipe puisse se connecter et rétablir le service.
 */
export function MaintenanceGate({ children }: { children: ReactNode }) {
  const fetchState = useServerFn(getMaintenance);
  const fetchAccess = useServerFn(getAdminAccess);
  const { session, user, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [state, setState] = useState<MaintenanceState>({ enabled: false, message: null });
  const [staff, setStaff] = useState<boolean | null>(null);

  const refresh = useCallback(() => {
    void fetchState()
      .then(setState)
      .catch(() => undefined);
  }, [fetchState]);

  // Vérifie l'état au chargement, toutes les 60 s, et au retour sur l'onglet.
  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 60_000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  // N'interroge les droits que si la maintenance est active.
  useEffect(() => {
    if (!state.enabled || loading) return;
    if (!session) {
      setStaff(false);
      return;
    }
    if (isOwnerEmail(user?.email)) {
      setStaff(true);
      return;
    }
    let cancelled = false;
    void fetchAccess({})
      .then((a) => !cancelled && setStaff(Boolean(a.isStaff || a.isAdmin)))
      .catch(() => !cancelled && setStaff(false));
    return () => {
      cancelled = true;
    };
  }, [state.enabled, loading, session, user?.email, fetchAccess]);

  if (!state.enabled) return <>{children}</>;
  if (pathname === "/" || pathname.startsWith("/admin")) return <>{children}</>;
  if (loading || staff === null) return <div className="min-h-screen bg-background" />;

  if (staff) {
    return (
      <>
        <div className="sticky top-0 z-[70] bg-amber-500 px-3 py-1.5 text-center text-xs font-semibold text-black">
          Mode maintenance actif : seule l'équipe voit l'application.
        </div>
        {children}
      </>
    );
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-background px-5"
      style={{ background: "var(--gradient-hero)" }}
    >
      <div className="w-full max-w-md rounded-3xl border border-border/70 bg-card/50 p-8 text-center backdrop-blur-xl">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Wrench className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Maintenance en cours</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          {state.message || DEFAULT_MESSAGE}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">Vos créations sont en sécurité.</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform active:scale-95"
          >
            <RefreshCw className="h-4 w-4" /> Actualiser
          </button>
          <Link
            to="/"
            className="rounded-full bg-secondary px-5 py-3 text-sm font-medium transition-transform active:scale-95"
          >
            Espace équipe
          </Link>
        </div>
      </div>
    </main>
  );
}
