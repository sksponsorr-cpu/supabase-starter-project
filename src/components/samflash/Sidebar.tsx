import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Image, Clock, Crown, Settings, Wand2, Menu, X, Search, PanelLeftClose, Plus, Trash2, Loader2, MessageSquare } from "lucide-react";
import { useState } from "react";
import logoAsset from "@/assets/sam-flash-logo.png";
import { toast } from "@/lib/toast";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useServerFn } from "@tanstack/react-start";
import { createProject, deleteProject } from "@/lib/project.functions";

export function Sidebar({
  onOpenSettings,
  onOpenPlans
}: {
  onOpenSettings: () => void;
  onOpenPlans: () => void;
}) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { items: projects, refresh } = useProjects(!!session);
  const addProject = useServerFn(createProject);
  const removeProject = useServerFn(deleteProject);
  const [isCreating, setIsCreating] = useState(false);
  const currentProjectId = (search as any)?.project;

  const handleAddProject = async () => {
    if (!session) {
      toast("Vous devez être connecté pour créer un projet");
      return;
    }
    setIsCreating(true);
    try {
      const id = await addProject({});
      await refresh();
      navigate({ to: "/app", search: { project: id } as any });
      if (window.innerWidth < 768) setIsOpen(false);
    } catch (error: any) {
      toast(error.message || "Erreur lors de la création du projet");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Supprimer ce projet et toutes ses générations ?")) return;
    try {
      await removeProject({ id });
      await refresh();
      if (currentProjectId === id) {
        navigate({ to: "/app" });
      }
    } catch (error: any) {
      toast(error.message || "Erreur lors de la suppression");
    }
  };
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

                <div className="px-5 py-3 shrink-0 flex flex-col">
          <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider shrink-0">Projets</h3>
          <button 
            onClick={handleAddProject}
            disabled={isCreating}
            className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors group mb-3 shrink-0"
          >
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-secondary/50 group-hover:bg-secondary transition-colors">
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </div>
            <span className="font-medium">Ajouter un projet</span>
          </button>
          
          <div className="space-y-0.5 -mx-2">
            {projects.map((p) => {
              const isActive = currentProjectId === p.id;
              return (
                <div key={p.id} className="group flex items-center justify-between rounded-lg hover:bg-secondary/50 transition-colors">
                  <Link
                    to="/app"
                    search={{ project: p.id } as any}
                    onClick={() => {
                      if (window.innerWidth < 768) setIsOpen(false);
                    }}
                    className={`flex flex-1 items-center gap-2.5 px-3 py-2 truncate ${
                      isActive ? "text-foreground font-medium bg-secondary/30" : "text-muted-foreground"
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    <span className="truncate text-sm">{p.title || "Nouveau projet"}</span>
                  </Link>
                  <button
                    onClick={(e) => handleDeleteProject(e, p.id)}
                    className="p-2 text-muted-foreground hover:text-red-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0 mr-1"
                    title="Supprimer le projet"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
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
