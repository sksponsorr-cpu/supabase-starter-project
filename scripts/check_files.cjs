const fs = require('fs');

const files = [
  'src/integrations/supabase/client.ts',
  'src/integrations/supabase/client.server.ts',
  'src/integrations/supabase/auth-middleware.ts',
  'src/lib/services/generation.server.ts',
  'src/lib/services/fal.server.ts',
  '.env',
  'package.json'
];

let result = '';

files.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (/ANON|SERVICE_ROLE/i.test(line)) {
        result += `${file}:${i+1}: ${line.trim()}\n`;
      }
    });
  }
});

fs.writeFileSync('c:/Users/ADAYI/Downloads/supabase-starter-project/search_results.txt', result);
process.exit(0);
