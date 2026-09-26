import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://zihjhzxpkbrzzwudbmwn.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppaGpoenhwa2Jyenp3dWRibXduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTA0NDgwOCwiZXhwIjoyMTA0NjIwODA4fQ.lzSuDaEFguoviexBLitg6-ewMHk1lOrmMUHqljOJHmM";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
  
  if (usersError) {
    console.error("Error fetching users:", usersError);
    process.exit(1);
  }

  const user = users.find(u => u.email === 'bonjoceflash@gmail.com');
  
  if (!user) {
    console.error("User bonjoceflash@gmail.com not found!");
    process.exit(1);
  }
  
  console.log("Found user:", user.id);

  const endsAt = new Date();
  endsAt.setDate(endsAt.getDate() + 30);
  
  const subData = {
    user_id: user.id,
    tier: "super_grok",
    status: "active",
    ends_at: endsAt.toISOString(),
  };

  const { data: inserted, error: insertError } = await supabase
    .from('subscriptions')
    .insert(subData)
    .select()
    .single();

  if (insertError) {
    console.error("Error inserting subscription:", insertError);
    process.exit(1);
  }

  console.log("Successfully inserted subscription:", JSON.stringify(inserted, null, 2));
  process.exit(0);
}

run();
