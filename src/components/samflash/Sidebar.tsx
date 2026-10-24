import { Link, useLocation } from "@tanstack/react-router";
import { Image, Clock, Crown, Settings, Wand2, Menu, X, Search, PanelLeftClose, PanelLeft, Gift, Coins, LayoutDashboard, GraduationCap, Store } from "lucide-react";
import { useEffect, useState } from "react";
import logoAsset from "@/assets/sam-flash-logo.png";
import { useSidebarStore } from "@/hooks/useSidebarStore";

const HINT_KEY = "sf_menu_hint_seen";

type SearchItem = { label: string; href?: string; action?: "plans" | "settings"; keys: string };

/** Destinations accessibles par la recherche du menu. */
const SEARCH_ITEMS: SearchItem[] = [
  { label: "Créer", href: "/app", keys: "créer studio image vidéo générer" },
  { label: "Formations", href: "/formations", keys: "formation formations tutoriel apprendre module" },
  { label: "Galerie", href: "/galerie", keys: "galerie créations publiques" },
  { label: "Historique", href: "/history", keys: "historique anciennes générations" },
  { label: "Plus outils AI", href: "/outils-ai", keys: "outils ai plus outils" },
  { label: "Tableau de bord", href: "/tableau-de-bord", keys: "tableau bord dépenses crédits coût" },
  { label: "Abonnement", action: "plans", keys: "abonnement forfait offre plans" },
  { label: "Parrainage", href: "/parrainage", keys: "parrainage parrain" },
  { label: "Monétise", href: "/monetise", keys: "monétise monétisation revenus" },
  { label: "Paramètres", action: "settings", keys: "paramètres réglages compte profil connecteurs" },
];

export function Sidebar({ onOpenSettings, onOpenPlans }: { onOpenSettings: () => void; onOpenPlans: () => void }) {
  const { pathname } = useLocation();
  const { isCollapsed, toggleCollapse } = useSidebarStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showHint, setShowHint] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 768 && !window.localStorage.getItem(HINT_KEY);
  });

  // L'indication « Ouvrez le menu ici » disparaît d'elle-même après 6 secondes.
  useEffect(() => {
    if (!showHint) return;
    const t = window.setTimeout(() => setShowHint(false), 6000);
    return () => window.clearTimeout(t);
  }, [showHint]);

  const openMenu = () => {
    setIsOpen(true);
    if (showHint) {
      setShowHint(false);
      window.localStorage.setItem(HINT_KEY, "1");
    }
  };

  const results = SEARCH_ITEMS.filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    return !q || item.label.toLowerCase().includes(q) || item.keys.includes(q);
  });

  const links = [
    { href: "/app", icon: Wand2, label: "Créer" },
    { href: "/galerie", icon: Image, label: "Galerie" },
    { href: "/history", icon: Clock, label: "Historique" },
    { href: "/outils-ai", icon: LayoutDashboard, label: "Plus outils AI" },
    { href: "/tableau-de-bord", icon: LayoutDashboard, label: "Tableau de bord" },
    { href: "/boutique", icon: Store, label: "Créer ma boutique" },
  ];

  const labelClass = `ml-3 font-medium whitespace-nowrap transition-opacity ${isCollapsed ? "md:opacity-0 md:hidden" : "opacity-100"}`;

  return (
    <>
      <style>{`
        @keyframes sfSpin { to { transform: rotate(360deg); } }
        @keyframes sfHint {
          0% { opacity: 0; transform: translateX(-8px); }
          8% { opacity: 1; transform: translateX(0); }
          85% { opacity: 1; transform: translateX(0); }
          100% { opacity: 0; transform: translateX(-8px); }
        }
        @keyframes sfPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }
      `}</style>

      <div className="fixed top-4 left-4 z-30 md:hidden">
        <button
          onClick={openMenu}
          aria-label="Ouvrir le menu"
          className="relative flex h-10 w-10 items-center justify-center rounded-full bg-background/80 backdrop-blur-md border border-border/50"
          style={showHint ? { animation: "sfPulse 1.2s ease-in-out infinite" } : undefined}
        >
          <Menu className="w-5 h-5" />
        </button>
        {showHint && (
          <span
            className="pointer-events-none absolute left-12 top-2 whitespace-nowrap rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg"
            style={{ animation: "sfHint 6s ease-in-out forwards" }}
          >
            Ouvrez le menu ici
          </span>
        )}
      </div>

      {isOpen && <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden" onClick={() => setIsOpen(false)} />}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-72 flex-col overflow-y-auto overflow-x-hidden border-r border-border/60 bg-background/95 backdrop-blur-xl transition-all duration-300 md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } ${isCollapsed ? "md:w-16" : "md:w-60"}`}
      >
        <div className="flex h-16 items-center justify-between px-4 shrink-0">
          <Link to="/app" className="flex items-center gap-3 overflow-hidden" onClick={() => setIsOpen(false)}>
            <img src={logoAsset} alt="Sam Flash 2.0" className="h-9 w-9 shrink-0 rounded-full object-cover shadow-sm" />
            <span className={`text-lg font-semibold tracking-tight whitespace-nowrap transition-opacity ${isCollapsed ? "md:opacity-0 md:hidden" : "opacity-100"}`}>
              Sam Flash
            </span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => { setIsSearching((v) => !v); setSearchQuery(""); }}
              className={`p-1.5 text-muted-foreground hover:bg-secondary/50 rounded-md hover:text-foreground transition-colors ${isCollapsed ? "hidden" : ""}`}
              title="Rechercher"
              aria-label="Rechercher"
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              onClick={toggleCollapse}
              className="hidden md:block p-1.5 text-muted-foreground hover:bg-secondary/50 rounded-md hover:text-foreground transition-colors"
              title={isCollapsed ? "Étendre" : "Réduire"}
            >
              {isCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>
            <button onClick={() => setIsOpen(false)} className="md:hidden p-1.5 text-muted-foreground hover:bg-secondary/50 rounded-md hover:text-foreground transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isSearching && (
          <div className="px-3 pb-2">
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher : formation, galerie, abonnement…"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary/60"
            />
            <ul className="mt-2 space-y-0.5">
              {results.map((item) => (
                <li key={item.label}>
                  {item.href ? (
                    <Link to={item.href} onClick={() => { setIsSearching(false); setIsOpen(false); }} className="block rounded-lg px-3 py-2 text-sm hover:bg-secondary/50">
                      {item.label}
                    </Link>
                  ) : (
                    <button
                      onClick={() => {
                        setIsSearching(false);
                        setIsOpen(false);
                        if (item.action === "plans") onOpenPlans();
                        else onOpenSettings();
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary/50"
                    >
                      {item.label}
                    </button>
                  )}
                </li>
              ))}
              {results.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Aucun résultat</li>}
            </ul>
          </div>
        )}

        <nav className="space-y-1 p-3 mt-2">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-start rounded-xl px-4 py-3 transition-colors ${
                  active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
                title={link.label}
              >
                <link.icon className={`h-5 w-5 shrink-0 ${active ? "text-primary" : ""}`} />
                <span className={labelClass}>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-3 shrink-0">
          <Link
            to="/formations"
            onClick={() => setIsOpen(false)}
            className="relative block overflow-hidden rounded-xl p-[1.5px]"
          >
            <span
              aria-hidden
              className="absolute inset-[-100%]"
              style={{
                background: "conic-gradient(from 0deg, transparent 0deg, hsl(var(--primary)) 90deg, transparent 180deg)",
                animation: "sfSpin 3s linear infinite",
              }}
            />
            <span className="relative flex items-center rounded-[10px] bg-background px-4 py-3 font-semibold text-foreground">
              <GraduationCap className="h-5 w-5 shrink-0 text-primary" />
              <span className={labelClass}>Formations</span>
            </span>
          </Link>
        </div>

        <div className="flex-1" />

        <div className="p-3 space-y-1 mb-2 shrink-0">
          <button
            onClick={() => { setIsOpen(false); onOpenPlans(); }}
            className="flex w-full items-center justify-start rounded-xl px-4 py-3 text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
          >
            <Crown className="h-5 w-5 shrink-0" />
            <span className={labelClass}>Abonnement</span>
          </button>
          <Link
            to="/parrainage"
            onClick={() => setIsOpen(false)}
            className={`flex w-full items-center justify-start rounded-xl px-4 py-3 transition-colors ${
              pathname === "/parrainage" ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            }`}
          >
            <Gift className="h-5 w-5 shrink-0" />
            <span className={labelClass}>Parrainage</span>
          </Link>
          <Link
            to="/monetise"
            onClick={() => setIsOpen(false)}
            className={`flex w-full items-center justify-start rounded-xl px-4 py-3 transition-colors ${
              pathname === "/monetise" ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            }`}
          >
            <Coins className="h-5 w-5 shrink-0" />
            <span className={labelClass}>Monétise</span>
          </Link>
          <button
            onClick={() => { setIsOpen(false); onOpenSettings(); }}
            className="flex w-full items-center justify-start rounded-xl px-4 py-3 text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
          >
            <Settings className="h-5 w-5 shrink-0" />
            <span className={labelClass}>Paramètres</span>
          </button>
        </div>
      </aside>
    </>
  );
}
