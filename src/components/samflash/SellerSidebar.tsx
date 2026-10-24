import { Link, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, Home, Sparkles, BarChart3, Wand2, Mic, Scissors, Store, Users, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/lib/toast";

type Item = { label: string; icon: React.ElementType; to?: string; soon?: boolean };

/** Menu propre à l'espace vendeur : séparé de l'espace créateur. */
const ITEMS: Item[] = [
  { label: "Accueil", icon: Home, to: "/vendeur" },
  { label: "Créative AI", icon: Wand2, to: "/vendeur" },
  { label: "Pub Track", icon: BarChart3, to: "/pub-track" },
  { label: "Motion design", icon: Sparkles, soon: true },
  { label: "Voix off", icon: Mic, to: "/voix-off" },
  { label: "Montage", icon: Scissors, soon: true },
  { label: "Créer ma boutique", icon: Store, to: "/boutique" },
  { label: "Expert marketing", icon: Users, soon: true },
  { label: "Parrainage", icon: Users, to: "/parrainage" },
  { label: "Paramètres vendeur", icon: Settings, to: "/vendeur/parametres" },
];

export function SellerSidebar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { user } = useAuth();
  const email = user?.email ?? "";
  const initial = (email || "V").charAt(0).toUpperCase();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le menu"
        className="fixed left-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 backdrop-blur-md border border-border/50"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && <div className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-72 flex-col overflow-y-auto border-r border-border/60 bg-background/95 backdrop-blur-xl transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <span className="text-lg font-semibold tracking-tight text-foreground">Espace vendeur</span>
          <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-md p-1.5 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="space-y-1 px-3">
          {ITEMS.map((item) => {
            const active = item.to === pathname;
            const cls = `flex w-full items-center rounded-xl px-4 py-3 text-left transition-colors ${
              active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            }`;
            const inner = (
              <>
                <item.icon className={`h-5 w-5 shrink-0 ${active ? "text-primary" : ""}`} />
                <span className="ml-3 font-medium whitespace-nowrap">{item.label}</span>
                {item.soon && <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/60">Bientôt</span>}
              </>
            );
            if (item.soon || !item.to) {
              return (
                <button key={item.label} type="button" className={cls} onClick={() => toast("Bientôt disponible.")}>
                  {inner}
                </button>
              );
            }
            return (
              <Link key={item.label} to={item.to} className={cls} onClick={() => setOpen(false)}>
                {inner}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-border/60 px-5 py-4">
          <Link to="/app" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
            ← Retour au mode créateur
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">{initial}</div>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
        </div>
      </aside>
    </>
  );
}
