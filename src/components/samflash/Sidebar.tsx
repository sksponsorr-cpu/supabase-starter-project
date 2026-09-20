import { Link, useLocation } from "@tanstack/react-router";
import { Image, Clock, Crown, Settings, Wand2 } from "lucide-react";
import logoAsset from "@/assets/sam-flash-logo.png";

export function Sidebar({
  onOpenSettings,
  onOpenPlans
}: {
  onOpenSettings: () => void;
  onOpenPlans: () => void;
}) {
  const { pathname } = useLocation();

  const links = [
    { href: "/app", icon: Wand2, label: "Créer" },
    { href: "/galerie", icon: Image, label: "Galerie" },
    { href: "/history", icon: Clock, label: "Historique" },
  ];

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-16 flex-col border-r border-border/60 bg-background/80 backdrop-blur-xl transition-all md:w-60">
      <div className="flex h-16 items-center justify-center md:justify-start md:px-4 shrink-0">
        <Link to="/app" className="flex items-center gap-3">
          <img
            src={logoAsset}
            alt="Sam Flash 2.0"
            className="h-9 w-9 shrink-0 rounded-full object-cover shadow-sm"
          />
          <span className="hidden text-lg font-semibold tracking-tight md:block">
            Sam Flash 2.0
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-2 p-3 mt-4">
        {links.map((link) => {
          const active = pathname === link.href || (pathname === "/app" && link.href === "/app");
          return (
            <Link
              key={link.href}
              to={link.href}
              className={lex items-center justify-center rounded-xl p-3 md:justify-start md:px-4 md:py-3 transition-colors }
              title={link.label}
            >
              <link.icon className={h-6 w-6 shrink-0 md:h-5 md:w-5 } />
              <span className="hidden ml-3 font-medium md:block">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 space-y-2 mb-4 shrink-0">
        <button
          onClick={onOpenPlans}
          className="flex w-full items-center justify-center rounded-xl p-3 text-muted-foreground hover:bg-secondary/50 hover:text-foreground md:justify-start md:px-4 md:py-3 transition-colors"
          title="Abonnement"
        >
          <Crown className="h-6 w-6 shrink-0 md:h-5 md:w-5" />
          <span className="hidden ml-3 font-medium md:block">Abonnement</span>
        </button>
        <button
          onClick={onOpenSettings}
          className="flex w-full items-center justify-center rounded-xl p-3 text-muted-foreground hover:bg-secondary/50 hover:text-foreground md:justify-start md:px-4 md:py-3 transition-colors"
          title="Paramètres"
        >
          <Settings className="h-6 w-6 shrink-0 md:h-5 md:w-5" />
          <span className="hidden ml-3 font-medium md:block">Paramètres</span>
        </button>
      </div>
    </aside>
  );
}
