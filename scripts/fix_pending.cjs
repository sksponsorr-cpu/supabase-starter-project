const fs = require('fs');
let s = fs.readFileSync('src/components/samflash/PromptBar.tsx', 'utf8');
s = s.replace(/} finally \{\s*if \(!isDone\) \{\s*setBusy\(false\);\s*onSettled\?\.\(\);\s*setTimeout\(\(\) => setSent\(null\), 2600\);\s*\}\s*\}/g, '} finally {\n      setBusy(false);\n      onSettled?.();\n      setTimeout(() => setSent(null), 3000);\n    }');
fs.writeFileSync('src/components/samflash/PromptBar.tsx', s);
