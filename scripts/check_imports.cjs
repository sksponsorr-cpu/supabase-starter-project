const fs = require('fs');

const addMissingImport = (file, importStatement) => {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes(importStatement)) {
        // Insert after last import
        const lastImportIndex = content.lastIndexOf('import ');
        if (lastImportIndex !== -1) {
            const nextLineIndex = content.indexOf('\n', lastImportIndex);
            content = content.slice(0, nextLineIndex + 1) + importStatement + '\n' + content.slice(nextLineIndex + 1);
        } else {
            content = importStatement + '\n' + content;
        }
        fs.writeFileSync(file, content);
        console.log(`Added ${importStatement} to ${file}`);
    }
};

// Check app.tsx
let appContent = fs.readFileSync('src/routes/app.tsx', 'utf8');
if (appContent.includes('useLocation') && !appContent.match(/import\s+{[^}]*useLocation[^}]*}\s+from\s+['"]@tanstack\/react-router['"]/)) {
    addMissingImport('src/routes/app.tsx', 'import { useLocation } from "@tanstack/react-router";');
}

// Check PromptBar.tsx
let promptBarContent = fs.readFileSync('src/components/samflash/PromptBar.tsx', 'utf8');
if (promptBarContent.includes('useLocation') && !promptBarContent.match(/import\s+{[^}]*useLocation[^}]*}\s+from\s+['"]@tanstack\/react-router['"]/)) {
    addMissingImport('src/components/samflash/PromptBar.tsx', 'import { useLocation } from "@tanstack/react-router";');
}

// Check Sidebar.tsx
let sidebarContent = fs.readFileSync('src/components/samflash/Sidebar.tsx', 'utf8');
if (sidebarContent.includes('useLocation') && !sidebarContent.match(/import\s+{[^}]*useLocation[^}]*}\s+from\s+['"]@tanstack\/react-router['"]/)) {
    addMissingImport('src/components/samflash/Sidebar.tsx', 'import { useLocation } from "@tanstack/react-router";');
}
if (sidebarContent.includes('useNavigate') && !sidebarContent.match(/import\s+{[^}]*useNavigate[^}]*}\s+from\s+['"]@tanstack\/react-router['"]/)) {
    addMissingImport('src/components/samflash/Sidebar.tsx', 'import { useNavigate } from "@tanstack/react-router";');
}

// Check history.tsx
let historyContent = fs.readFileSync('src/routes/history.tsx', 'utf8');
if (historyContent.includes('useLocation') && !historyContent.match(/import\s+{[^}]*useLocation[^}]*}\s+from\s+['"]@tanstack\/react-router['"]/)) {
    addMissingImport('src/routes/history.tsx', 'import { useLocation } from "@tanstack/react-router";');
}
if (historyContent.includes('useNavigate') && !historyContent.match(/import\s+{[^}]*useNavigate[^}]*}\s+from\s+['"]@tanstack\/react-router['"]/)) {
    addMissingImport('src/routes/history.tsx', 'import { useNavigate } from "@tanstack/react-router";');
}

console.log("Done checking imports.");
