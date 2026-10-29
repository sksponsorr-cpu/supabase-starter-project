import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { analyzeWithGemini } from "@/lib/services/gemini.server";

/**
 * Expert marketing : conseils marketing générés par Gemini via KIE uniquement.
 * Aucune réponse statique : tout vient du service IA, à partir des informations fournies.
 */
const input = z.object({
  sector: z.string().trim().min(2, "Indique ton secteur d'activité.").max(120),
  product: z.string().trim().min(2, "Indique ton produit ou service.").max(200),
  price: z.string().trim().max(60).default(""),
  audience: z.string().trim().max(200).default(""),
  objective: z.string().trim().max(200).default(""),
  network: z.enum(["Facebook", "Instagram", "TikTok", "WhatsApp", "YouTube", "Autre"]).default("Instagram"),
  language: z.string().trim().max(40).default("français"),
});

export const askExpertMarketing = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => input.parse(raw))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    const prompt = [
      "Tu es un expert marketing pour petits commerçants. Réponds dans la langue demandée, de façon concrète et directe, sans jargon.",
      "Base-toi uniquement sur les informations fournies. N'invente pas de chiffres, de résultats ni d'avis clients.",
      "",
      `Langue : ${data.language}`,
      `Secteur : ${data.sector}`,
      `Produit ou service : ${data.product}`,
      data.price ? `Prix : ${data.price}` : "",
      data.audience ? `Public cible : ${data.audience}` : "",
      data.objective ? `Objectif commercial : ${data.objective}` : "",
      `Réseau social visé : ${data.network}`,
      "",
      "Réponds avec ces sections, titres compris :",
      "IDÉES DE CAMPAGNE : 3 idées courtes.",
      "ACCROCHES : 5 accroches, une par ligne.",
      "SCRIPT VIDÉO : un script de 20 à 30 secondes, avec ce qui est dit et ce qui est montré.",
      "DESCRIPTION PRODUIT : 2 à 3 phrases.",
      `TEXTE POUR ${data.network.toUpperCase()} : un texte prêt à publier.`,
      "APPELS À L'ACTION : 3 phrases courtes.",
      "CONTENU RECOMMANDÉ : 3 types de contenus adaptés à ce produit et à ce réseau.",
    ]
      .filter((l) => l !== "")
      .join("\n");

    const res = await analyzeWithGemini({ prompt, thinking: "low" });
    if (res.ok === false) return { ok: false as const, message: res.message };
    return { ok: true as const, text: res.text };
  });
