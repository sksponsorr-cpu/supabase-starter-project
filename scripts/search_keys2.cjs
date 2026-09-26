const fs = require('fs');
const path = require('path');

let out = "";
function search(dir, regex) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      search(fullPath, regex);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.js') || fullPath.endsWith('.cjs')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (regex.test(content)) {
        out += `Found in: ${fullPath}\n`;
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            out += `  Line ${i + 1}: ${lines[i].trim()}\n`;
          }
        }
      }
    }
  }
}

out += "Searching for ANON | SERVICE_ROLE...\n";
search(path.join(__dirname, '../src'), /ANON|SERVICE_ROLE/i);
out += "Searching for PUBLISHABLE...\n";
search(path.join(__dirname, '../src'), /PUBLISHABLE/i);
out += "Done.\n";
fs.writeFileSync('search_results.txt', out);
