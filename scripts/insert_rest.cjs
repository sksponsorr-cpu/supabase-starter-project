const url = "https://zihjhzxpkbrzzwudbmwn.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppaGpoenhwa2Jyenp3dWRibXduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTA0NDgwOCwiZXhwIjoyMTA0NjIwODA4fQ.lzSuDaEFguoviexBLitg6-ewMHk1lOrmMUHqljOJHmM";
const fs = require('fs');

async function run() {
  try {
    const res = await fetch(url + '/auth/v1/admin/users', {
      headers: {
        'Authorization': 'Bearer ' + key,
        'apikey': key
      }
    });
    const users = await res.json();
    
    if (users.error) {
       fs.writeFileSync('insert_log.txt', JSON.stringify(users.error));
       return;
    }

    const user = users.users.find(u => u.email === 'bonjoceflash@gmail.com');
    if (!user) {
       fs.writeFileSync('insert_log.txt', 'User not found');
       return;
    }

    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + 30);
    
    const subData = {
      user_id: user.id,
      tier: "super_grok",
      status: "active",
      ends_at: endsAt.toISOString(),
    };

    const insertRes = await fetch(url + '/rest/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + key,
        'apikey': key,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(subData)
    });

    const inserted = await insertRes.json();
    fs.writeFileSync('insert_log.txt', JSON.stringify(inserted, null, 2));

  } catch(e) {
    fs.writeFileSync('insert_log.txt', e.toString());
  }
}

run();
