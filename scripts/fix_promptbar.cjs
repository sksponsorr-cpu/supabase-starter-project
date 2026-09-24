const fs = require('fs');

// 1. Fix PromptBar.tsx
let promptBar = fs.readFileSync('src/components/samflash/PromptBar.tsx', 'utf8');

// Bug 5: Mic Button
promptBar = promptBar.replace(
  'isListening ? "text-red-500 animate-pulse" : "text-muted-foreground hover:bg-secondary/50"',
  'isListening ? "bg-red-500/20 text-red-600 animate-pulse ring-2 ring-red-500/50" : "text-muted-foreground hover:bg-secondary/50"'
);

// Bug 6: Spacing
promptBar = promptBar.replace(
  'className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto pl-1 sm:pl-2"',
  'className="flex items-center gap-3 sm:gap-1.5 shrink-0 ml-auto pl-1 sm:pl-2"'
);

// Auto-name project logic (Bug 4)
if (!promptBar.includes('updateProjectTitle')) {
  promptBar = promptBar.replace(
    'import { generateMedia, checkGenerationStatus, cancelGeneration } from "@/lib/generation.functions";',
    'import { generateMedia, checkGenerationStatus, cancelGeneration } from "@/lib/generation.functions";\nimport { updateProjectTitle } from "@/lib/project.functions";'
  );
  
  promptBar = promptBar.replace(
    'const checkAccess = useServerFn(getGenerationAccess);',
    'const checkAccess = useServerFn(getGenerationAccess);\n  const renameProj = useServerFn(updateProjectTitle);\n  const { search } = useLocation();\n  const currentProjectId = (search as any)?.project;'
  );

  // We need useLocation. Check if imported.
  if (!promptBar.includes('useLocation')) {
    promptBar = promptBar.replace(
      'import { useServerFn } from "@tanstack/react-start";',
      'import { useServerFn } from "@tanstack/react-start";\nimport { useLocation } from "@tanstack/react-router";'
    );
  }

  // Inject rename logic on generated
  // find generate() call and pass project_id
  promptBar = promptBar.replace(
    'data: { prompt, mediaType: mode, resolution: res, duration: dur, aspectRatio: ratio }',
    'data: { prompt, mediaType: mode, resolution: res, duration: dur, aspectRatio: ratio, project_id: currentProjectId }'
  );

  // After onGenerated() call
  promptBar = promptBar.replace(
    /onGenerated\?\.\(\);\s*\} else if \(result\.status === "pending"/,
    `onGenerated?.();
            if (currentProjectId) {
              renameProj({ data: { id: currentProjectId, title: prompt.split(" ").slice(0, 5).join(" ") } }).catch(() => {});
            }
          } else if (result.status === "pending"`
  );
  
  // also inside polling success block
  promptBar = promptBar.replace(
    /onGenerated\?\.\(\);\s*\} else if \(statusResult\.status === "error"/,
    `onGenerated?.();
              if (currentProjectId) {
                renameProj({ data: { id: currentProjectId, title: prompt.split(" ").slice(0, 5).join(" ") } }).catch(() => {});
              }
            } else if (statusResult.status === "error"`
  );
}

fs.writeFileSync('src/components/samflash/PromptBar.tsx', promptBar);
