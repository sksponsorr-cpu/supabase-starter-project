import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { analyzeWithGemini } from "@/lib/services/gemini.server";

/**
 * Texte publicitaire pour Flash Business (Créative AI).
 * Génération réelle via Gemini sur KIE (KIE_API_KEY, côté serveur uniquement).
 * Ne consomme pas de crédits Sam Flash pour l'instant : à décider avant mise en production.
 */
const input = z.object({
  product: z.string().trim().min(2, "Donne le nom du produit.").max(120),
  price: z.string().trim().max(60).default(""),
  description: z.string().trim().max(800).default(""),
  benefits: z.string().trim().max(500).default(""),
  audience: z.string().trim().max(200).default(""),
  objective: z.string().trim().max(200).default(""),
  language: z.string().trim().max(40).default("français"),
  format: z.enum(["affiche", "image promotionnelle", "vidéo publicitaire"]).default("vidéo publicitaire"),
});

export type AdCopyInput = z.input<typeof input>;

export const generateAdCopy = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => input.parse(raw))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    const prompt = [
      "Tu rédiges une publicité courte pour un commerçant. Écris dans la langue demandée, avec un ton de personne réelle, sans jargon publicitaire.",
      "Règles :",
      "- L'accroche doit faire arrêter le scroll dans les 2 premières secondes.",
      "- Une seule raison claire d'acheter.",
      "- N'invente aucun chiffre, aucune garantie, aucun avis client qui ne soit pas fourni.",
      "- Si le prix n'est pas fourni, ne mentionne pas de prix.",
      "",
      `Langue : ${data.language}`,
      `Type de création : ${data.format}`,
      `Produit : ${data.product}`,
      data.price ? `Prix : ${data.price}` : "",
      data.description ? `Description : ${data.description}` : "",
      data.benefits ? `Avantages : ${data.benefits}` : "",
      data.audience ? `Public cible : ${data.audience}` : "",
      data.objective ? `Objectif commercial : ${data.objective}` : "",
      "",
      "Réponds exactement avec ces 4 blocs, titres compris :",
      "ACCROCHE : une phrase.",
      "TEXTE : 2 à 3 phrases.",
      "APPEL À L'ACTION : une phrase.",
      "SCÈNE : description courte de la scène visuelle ou vidéo (3 à 4 phrases), sans texte à l'écran.",
    ]
      .filter((l) => l !== "")
      .join("\n");

    const res = await analyzeWithGemini({ prompt, thinking: "low" });
    if (res.ok === false) return { ok: false as const, message: res.message };
    return { ok: true as const, text: res.text };
  });
