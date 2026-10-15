import { createServerFn } from "@tanstack/react-start";
import { getCreditConfig } from "@/lib/credits.server";

/** Valeurs de crédits publiques (sans marge ni coût fal.ai). Utilisées pour l'affichage du coût en direct. */
export const getPublicCreditConfig = createServerFn({ method: "GET" }).handler(async () => {
  const config = await getCreditConfig();
  return { videoPerSecond: config.videoPerSecond, cloneVideoPerSecond: config.cloneVideoPerSecond };
});
