import { Link, useLocation } from "@tanstack/react-router";
import { Image, Clock, Crown, Settings, Wand2, Menu, X } from "lucide-react";
import { useState } from "react";
import logoAsset from "@/assets/sam-flash-logo.png";

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

      <aside className={`fixed left-0 top-0 z-50 flex h-screen w-64 flex-col overflow-y-auto border-r border-border/60 bg-background/95 backdrop-blur-xl transition-transform duration-300 md:w-60 md:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center justify-between px-4 shrink-0">
          <Link to="/app" className="flex items-center gap-3" onClick={() => setIsOpen(false)}>
            <img
              src={logoAsset}
              alt="Sam Flash 2.0"
              className="h-9 w-9 shrink-0 rounded-full object-cover shadow-sm"
            />
            <span className="text-lg font-semibold tracking-tight">
              Sam Flash 2.0
            </span>
          </Link>
          <button onClick={() => setIsOpen(false)} className="md:hidden text-muted-foreground hover:text-foreground">
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 space-y-2 p-3 mt-2">
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

        <div className="p-3 space-y-2 mb-4 shrink-0">
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
