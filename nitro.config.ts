import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  // Durée max d'exécution des Serverless Functions Vercel : 300 s (max Hobby).
  // S'applique à toutes les routes serveur, dont checkGenerationStatus
  // (polling Fal.ai → téléchargement MP4 → upload Supabase Storage).
  vercel: {
    functions: {
      maxDuration: 300,
    },
  },
});
