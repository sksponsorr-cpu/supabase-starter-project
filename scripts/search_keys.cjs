const fs = require('fs');
const path = require('path');

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
        console.log(`Found in: ${fullPath}`);
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            console.log(`  Line ${i + 1}: ${lines[i].trim()}`);
          }
        }
      }
    }
  }
}

console.log("Searching for ANON | SERVICE_ROLE...");
search(path.join(__dirname, '../src'), /ANON|SERVICE_ROLE/i);
console.log("Done.");
