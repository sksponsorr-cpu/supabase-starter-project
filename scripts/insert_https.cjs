const https = require('https');

const options = {
  hostname: 'zihjhzxpkbrzzwudbmwn.supabase.co',
  port: 443,
  path: '/auth/v1/admin/users',
  method: 'GET',
  family: 4, // Force IPv4
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppaGpoenhwa2Jyenp3dWRibXduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTA0NDgwOCwiZXhwIjoyMTA0NjIwODA4fQ.lzSuDaEFguoviexBLitg6-ewMHk1lOrmMUHqljOJHmM',
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppaGpoenhwa2Jyenp3dWRibXduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTA0NDgwOCwiZXhwIjoyMTA0NjIwODA4fQ.lzSuDaEFguoviexBLitg6-ewMHk1lOrmMUHqljOJHmM',
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    require('fs').writeFileSync('insert_log.txt', data);
  });
});

req.on('error', (e) => {
  require('fs').writeFileSync('insert_log.txt', 'Error: ' + e.message);
});

req.end();
