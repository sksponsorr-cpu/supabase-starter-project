const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Vérifie que SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont dans .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Recherche de l'utilisateur bonjoceflash@gmail.com...");
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
  
  if (usersError) {
    console.error("Erreur lors de la récupération des utilisateurs :", usersError);
    process.exit(1);
  }

  const user = users.find(u => u.email === 'bonjoceflash@gmail.com');
  
  if (!user) {
    console.error("Utilisateur bonjoceflash@gmail.com introuvable !");
    process.exit(1);
  }
  
  console.log("✅ ID Utilisateur trouvé :", user.id);

  const endsAt = new Date();
  endsAt.setDate(endsAt.getDate() + 30);
  
  const subData = {
    user_id: user.id,
    tier: "super_grok",
    status: "active",
    ends_at: endsAt.toISOString(),
  };

  console.log("Insertion de l'abonnement...");
  const { data: inserted, error: insertError } = await supabase
    .from('subscriptions')
    .insert(subData)
    .select()
    .single();

  if (insertError) {
    console.error("Erreur lors de l'insertion :", insertError);
    process.exit(1);
  }

  console.log("\n🎉 Ligne insérée avec succès dans la table 'subscriptions' :");
  console.log(JSON.stringify(inserted, null, 2));
}

run();
