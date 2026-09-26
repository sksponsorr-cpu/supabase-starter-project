const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
  const fullPath = path.resolve(__dirname, '..', filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${fullPath}`);
    return;
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  for (const { search, replace } of replacements) {
    if (search instanceof RegExp) {
      content = content.replace(search, replace);
    } else {
      content = content.split(search).join(replace);
    }
  }
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`Updated ${filePath}`);
}

// 1. client.ts
replaceInFile('src/integrations/supabase/client.ts', [
  { search: /function isNewSupabaseApiKey[\s\S]*?\}\n\n/, replace: '' },
  { search: /\s*\/\/ New Supabase API keys are opaque strings, not bearer JWTs\.\n\s*if \(isNewSupabaseApiKey\(supabaseKey\) && headers\.get\('Authorization'\) === `Bearer \$\{supabaseKey\}`\) \{\n\s*headers\.delete\('Authorization'\);\n\s*\}/g, replace: '' },
  { search: / \|\| process\.env\['EXTERNAL_SUPABASE_ANON_KEY'\]/g, replace: '' }
]);

// 2. client.server.ts
replaceInFile('src/integrations/supabase/client.server.ts', [
  { search: /function isNewSupabaseApiKey[\s\S]*?\}\n\n/, replace: '' },
  { search: /\s*\/\/ New Supabase API keys are opaque strings, not bearer JWTs\.\n\s*if \(isNewSupabaseApiKey\(supabaseKey\) && headers\.get\('Authorization'\) === `Bearer \$\{supabaseKey\}`\) \{\n\s*headers\.delete\('Authorization'\);\n\s*\}/g, replace: '' },
  { search: / \?\? process\.env\['EXTERNAL_SUPABASE_SERVICE_ROLE_KEY'\]/g, replace: '' }
]);

// 3. auth-middleware.ts
replaceInFile('src/integrations/supabase/auth-middleware.ts', [
  { search: /function isNewSupabaseApiKey[\s\S]*?\}\n\n/, replace: '' },
  { search: /\s*\/\/ New Supabase API keys are opaque strings, not bearer JWTs\.\n\s*if \(isNewSupabaseApiKey\(supabaseKey\) && headers\.get\('Authorization'\) === `Bearer \$\{supabaseKey\}`\) \{\n\s*headers\.delete\('Authorization'\);\n\s*\}/g, replace: '' },
  { search: / \?\? process\.env\['EXTERNAL_SUPABASE_ANON_KEY'\]/g, replace: '' }
]);

// 4. .env
replaceInFile('.env', [
  { search: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppaGpoenhwa2Jyenp3dWRibXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDQ4MDgsImV4cCI6MjEwNDYyMDgwOH0\.a5vIvPeoukTX5TyaZ0_XwAxEEkWxslC46Irf0bBXPwY/g, replace: 'sb_publishable_dummy12345' },
  { search: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppaGpoenhwa2Jyenp3dWRibXduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTA0NDgwOCwiZXhwIjoyMTA0NjIwODA4fQ\.lzSuDaEFguoviexBLitg6-ewMHk1lOrmMUHqljOJHmM/g, replace: 'sb_secret_dummy12345' }
]);

console.log("Done");
