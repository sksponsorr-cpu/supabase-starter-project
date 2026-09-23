import { Link, useLocation } from "@tanstack/react-router";
import { Image, Clock, Crown, Settings, Wand2, Menu, X, Search, PanelLeftClose, Plus } from "lucide-react";
import { useState } from "react";
import logoAsset from "@/assets/sam-flash-logo.png";
import { toast } from "@/lib/toast";

export function Sidebar({
  onOpenSettings,
  onOpenPlans
}: {
  onOpenSettings: () => void;
  onOpenPlans: () => void;
}) {
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const links = [
    { href: "/app", icon: Wand2, label: "Créer" },
    { href: "/galerie", icon: Image, label: "Galerie" },
    { href: "/history", icon: Clock, label: "Historique" },
  ];

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 backdrop-blur-md border border-border/50 md:hidden"
      >
        <Menu className="w-5 h-5" />
      </button>

      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden" 
          onClick={() => setIsOpen(false)} 
        />
      )}

      <aside className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-72 flex-col overflow-y-auto border-r border-border/60 bg-background/95 backdrop-blur-xl transition-transform duration-300 md:w-60 md:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center justify-between px-4 shrink-0">
          <Link to="/app" className="flex items-center gap-3" onClick={() => setIsOpen(false)}>
            <img
              src={logoAsset}
              alt="Sam Flash 2.0"
              className="h-9 w-9 shrink-0 rounded-full object-cover shadow-sm"
            />
            <span className="text-lg font-semibold tracking-tight">
              Sam Flash
            </span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <button 
              onClick={() => toast("Recherche bientôt disponible")}
              className="p-1.5 text-muted-foreground hover:bg-secondary/50 rounded-md hover:text-foreground transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
            <button 
              onClick={() => toast("Rétraction bientôt disponible")}
              className="hidden md:block p-1.5 text-muted-foreground hover:bg-secondary/50 rounded-md hover:text-foreground transition-colors"
            >
              <PanelLeftClose className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsOpen(false)} 
              className="md:hidden p-1.5 text-muted-foreground hover:bg-secondary/50 rounded-md hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <nav className="space-y-1 p-3 mt-2">
          {links.map((link) => {
            const active = pathname === link.href || (pathname === "/app" && link.href === "/app");
            return (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-start rounded-xl px-4 py-3 transition-colors ${
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
                title={link.label}
              >
                <link.icon className={`h-5 w-5 shrink-0 ${active ? "text-primary" : ""}`} />
                <span className="ml-3 font-medium">{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-3">
          <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Projets</h3>
          <button 
            onClick={() => toast("Fonctionnalité bientôt disponible")}
            className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-secondary/50 group-hover:bg-secondary transition-colors">
              <Plus className="w-4 h-4" />
            </div>
            <span className="font-medium">Ajouter un projet</span>
          </button>
        </div>

        <div className="flex-1" />

        <div className="p-3 space-y-1 mb-2 shrink-0">
          <button
            onClick={() => {
              setIsOpen(false);
              onOpenPlans();
            }}
            className="flex w-full items-center justify-start rounded-xl px-4 py-3 text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
          >
            <Crown className="h-5 w-5 shrink-0" />
            <span className="ml-3 font-medium">Abonnement</span>
          </button>
          <button
            onClick={() => {
              setIsOpen(false);
              onOpenSettings();
            }}
            className="flex w-full items-center justify-start rounded-xl px-4 py-3 text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
          >
            <Settings className="h-5 w-5 shrink-0" />
            <span className="ml-3 font-medium">Paramètres</span>
          </button>
        </div>
      </aside>
    </>
  );
}
