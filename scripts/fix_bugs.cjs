const fs = require('fs');
let sidebar = fs.readFileSync('src/components/samflash/Sidebar.tsx', 'utf8');

sidebar = sidebar.replace(/await removeProject\(\{\s*id\s*\}\);/, 'await removeProject({ data: { id } });');

if (!sidebar.includes('PanelLeft,')) {
    sidebar = sidebar.replace('PanelLeftClose,', 'PanelLeftClose, PanelLeft,');
}
if (!sidebar.includes('useSidebarStore')) {
    sidebar = sidebar.replace('import { useProjects } from "@/hooks/useProjects";', 'import { useProjects } from "@/hooks/useProjects";\nimport { useSidebarStore } from "@/hooks/useSidebarStore";');
}

sidebar = sidebar.replace('const currentProjectId = (search as any)?.project;', 'const currentProjectId = (search as any)?.project;\n  const [isSearching, setIsSearching] = useState(false);\n  const [searchQuery, setSearchQuery] = useState("");\n  const { isCollapsed, toggleCollapse, setCollapsed } = useSidebarStore();\n  const filteredProjects = projects.filter(p => (p.title || "Nouveau projet").toLowerCase().includes(searchQuery.toLowerCase()));');

sidebar = sidebar.replace(
  'className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-72 flex-col overflow-y-auto border-r border-border/60 bg-background/95 backdrop-blur-xl transition-transform duration-300 md:w-60 md:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}',
  'className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-72 flex-col overflow-y-auto border-r border-border/60 bg-background/95 backdrop-blur-xl transition-all duration-300 md:translate-x-0 overflow-x-hidden ${isOpen ? "translate-x-0" : "-translate-x-full"} ${isCollapsed ? "md:w-16" : "md:w-60"}`}'
);

sidebar = sidebar.replace(
  /<Link to="\/app" className="flex items-center gap-3"[\s\S]*?<\/Link>/,
  `<Link to="/app" className="flex items-center gap-3 overflow-hidden" onClick={() => setIsOpen(false)}>
            <img
              src={logoAsset}
              alt="Sam Flash 2.0"
              className="h-9 w-9 shrink-0 rounded-full object-cover shadow-sm"
            />
            <span className={\`text-lg font-semibold tracking-tight whitespace-nowrap transition-opacity \${isCollapsed ? "md:opacity-0 md:hidden" : "opacity-100"}\`}>
              Sam Flash
            </span>
          </Link>`
);

sidebar = sidebar.replace(
  /<button \s*onClick=\{\(\) => toast\("Recherche bientôt disponible"\)\}[\s\S]*?<\/button>/,
  `<button 
              onClick={() => { setIsSearching(true); setCollapsed(false); }}
              className={\`p-1.5 text-muted-foreground hover:bg-secondary/50 rounded-md hover:text-foreground transition-colors \${isCollapsed ? "hidden" : ""}\`}
              title="Rechercher"
            >
              <Search className="w-5 h-5" />
            </button>`
);

sidebar = sidebar.replace(
  /<button \s*onClick=\{\(\) => toast\("Rétraction bientôt disponible"\)\}[\s\S]*?<\/button>/,
  `<button 
              onClick={toggleCollapse}
              className="hidden md:block p-1.5 text-muted-foreground hover:bg-secondary/50 rounded-md hover:text-foreground transition-colors"
              title={isCollapsed ? "Étendre" : "Réduire"}
            >
              {isCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>`
);

sidebar = sidebar.replace(
  /<span className="ml-3 font-medium">\{link\.label\}<\/span>/g,
  `<span className={\`ml-3 font-medium whitespace-nowrap transition-opacity \${isCollapsed ? "md:opacity-0 md:hidden" : "opacity-100"}\`}>{link.label}</span>`
);

sidebar = sidebar.replace(
  /<span className="ml-3 font-medium">Abonnement<\/span>/,
  `<span className={\`ml-3 font-medium whitespace-nowrap transition-opacity \${isCollapsed ? "md:opacity-0 md:hidden" : "opacity-100"}\`}>Abonnement</span>`
);

sidebar = sidebar.replace(
  /<span className="ml-3 font-medium">Paramètres<\/span>/,
  `<span className={\`ml-3 font-medium whitespace-nowrap transition-opacity \${isCollapsed ? "md:opacity-0 md:hidden" : "opacity-100"}\`}>Paramètres</span>`
);

const projBlock = `        <div className={\`px-5 py-3 shrink-0 flex flex-col \${isCollapsed ? "md:hidden" : ""}\`}>
          <div className="flex items-center justify-between mb-3 shrink-0">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Projets</h3>
          </div>
          
          {isSearching ? (
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-secondary/50 rounded-md pl-8 pr-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <button onClick={() => { setIsSearching(false); setSearchQuery(""); }} className="p-1.5 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleAddProject}
              disabled={isCreating}
              className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors group mb-3 shrink-0"
            >
              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-secondary/50 group-hover:bg-secondary transition-colors">
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </div>
              <span className="font-medium whitespace-nowrap">Ajouter un projet</span>
            </button>
          )}
          
          <div className="space-y-0.5 -mx-2">
            {filteredProjects.map((p) => {
              const isActive = currentProjectId === p.id;
              return (
                <div key={p.id} className="group flex items-center justify-between rounded-lg hover:bg-secondary/50 transition-colors">
                  <Link
                    to="/app"
                    search={{ project: p.id } as any}
                    onClick={() => {
                      if (window.innerWidth < 768) setIsOpen(false);
                    }}
                    className={\`flex flex-1 items-center gap-2.5 px-3 py-2 truncate \${
                      isActive ? "text-foreground font-medium bg-secondary/30" : "text-muted-foreground"
                    }\`}
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
            {filteredProjects.length === 0 && isSearching && (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun projet trouvé</p>
            )}
          </div>
        </div>`;

sidebar = sidebar.replace(/<div className="px-5 py-3 shrink-0 flex flex-col">[\s\S]*?<\/div>\s*<\/div>\s*<div className="flex-1" \/>/, projBlock + '\n\n        <div className="flex-1" />');

// also fix useSidebarStore missing `setCollapsed` inside the store
let storeContent = fs.readFileSync('src/hooks/useSidebarStore.ts', 'utf8');
if (!storeContent.includes('setCollapsed:')) {
    storeContent = storeContent.replace(
      'toggle() {',
      'setCollapsed(val: boolean) {\n    this.collapsed = val;\n    this.dispatchEvent(new Event("change"));\n  }\n\n  toggle() {'
    );
    storeContent = storeContent.replace(
      'toggleCollapse: () => sidebarStore.toggle()',
      'toggleCollapse: () => sidebarStore.toggle(), setCollapsed: (val: boolean) => sidebarStore.setCollapsed(val)'
    );
    fs.writeFileSync('src/hooks/useSidebarStore.ts', storeContent);
}

fs.writeFileSync('src/components/samflash/Sidebar.tsx', sidebar);


// 2. updateProjectTitle in project.functions.ts
let projFuncs = fs.readFileSync('src/lib/project.functions.ts', 'utf8');
if (!projFuncs.includes('updateProjectTitle')) {
  projFuncs += `

export const updateProjectTitle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; title: string }) => {
    if (!input?.id || !input?.title) throw new Error("Identifiant ou titre manquant");
    return { id: String(input.id), title: String(input.title) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("projects")
      .update({ title: data.title.trim() })
      .eq("id", data.id)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
`;
  fs.writeFileSync('src/lib/project.functions.ts', projFuncs);
}

// 3. app.tsx and history.tsx layout padding syncing
let appTsx = fs.readFileSync('src/routes/app.tsx', 'utf8');
if (!appTsx.includes('const { isCollapsed } = useSidebarStore();')) {
  appTsx = appTsx.replace('import { Sidebar } from "@/components/samflash/Sidebar";', 'import { Sidebar } from "@/components/samflash/Sidebar";\nimport { useSidebarStore } from "@/hooks/useSidebarStore";\nimport { updateProjectTitle } from "@/lib/project.functions";');
  appTsx = appTsx.replace('function AppFeed() {', 'function AppFeed() {\n  const { isCollapsed } = useSidebarStore();');
  appTsx = appTsx.replace('className="flex-1 md:pl-60 transition-all flex flex-col overflow-x-hidden"', 'className={`flex-1 transition-all flex flex-col overflow-x-hidden ${isCollapsed ? "md:pl-16" : "md:pl-60"}`}');
  
  // Also, add logic to update project title on first generation!
  // It happens inside `PromptBar.tsx`? The prompt says "appelée depuis app.tsx juste après la création réussie de la première génération d'un projet dont le titre est encore par défaut".
  // Let's hook into `onGenerated`. `onGenerated={() => void refresh()}` is in app.tsx.
  // Actually, we can intercept `submit` or `runGeneration`?
  // Let's check where generations are submitted. It's inside `PromptBar.tsx`.
}
fs.writeFileSync('src/routes/app.tsx', appTsx);

let historyTsx = fs.readFileSync('src/routes/history.tsx', 'utf8');
if (!historyTsx.includes('const { isCollapsed } = useSidebarStore();')) {
  historyTsx = historyTsx.replace('import { Sidebar } from "@/components/samflash/Sidebar";', 'import { Sidebar } from "@/components/samflash/Sidebar";\nimport { useSidebarStore } from "@/hooks/useSidebarStore";');
  historyTsx = historyTsx.replace('function History() {', 'function History() {\n  const { isCollapsed } = useSidebarStore();');
  historyTsx = historyTsx.replace('className="flex-1 md:pl-60 transition-all flex flex-col overflow-x-hidden"', 'className={`flex-1 transition-all flex flex-col overflow-x-hidden ${isCollapsed ? "md:pl-16" : "md:pl-60"}`}');
  fs.writeFileSync('src/routes/history.tsx', historyTsx);
}
