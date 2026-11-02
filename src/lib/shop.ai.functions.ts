import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { analyzeWithGemini } from "@/lib/services/gemini.server";

/**
 * Création de produit par l'IA : le vendeur envoie une photo ou un lien de produit,
 * l'IA propose le nom, la catégorie et la description. Le prix est saisi par le vendeur.
 * Rien n'est enregistré ici : le vendeur valide ensuite (saveProduct).
 */

type Draft = { name: string; category: string; description: string; imageUrl: string | null };

const PROMPT_RULES =
  "Tu prépares une fiche produit pour une boutique en ligne. Écris en français, avec un ton naturel, sans jargon. " +
  "Réponds UNIQUEMENT avec un objet JSON strict : {\"name\": string, \"category\": string, \"description\": string}. " +
  "name : nom court du produit (max 80 caractères). category : une catégorie courte (ex. Homme, Femme, Beauté, Maison, Électronique). " +
  "description : 2 à 4 phrases claires sur le produit, ses atouts et son usage. Pas de prix.";

function parseDraft(text: string): Omit<Draft, "imageUrl"> | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]) as Partial<Draft>;
    if (!j.name || typeof j.name !== "string") return null;
    return {
      name: j.name.trim().slice(0, 120),
      category: (j.category ?? "").toString().trim().slice(0, 80),
      description: (j.description ?? "").toString().trim().slice(0, 800),
    };
  } catch {
    return null;
  }
}

/** Fiche produit à partir d'une photo que le vendeur vient d'ajouter. */
export const draftProductFromPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mimeType: "image/jpeg" | "image/png" | "image/webp"; data: string; imageUrl: string | null }) =>
    z
      .object({
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        data: z.string().min(100).max(8_000_000),
        imageUrl: z.string().url().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const res = await analyzeWithGemini({
      prompt: `${PROMPT_RULES} Décris le produit visible sur cette photo.`,
      images: [{ mimeType: data.mimeType, data: data.data }],
    });
    if (!res.ok) return { ok: false as const, message: res.message, draft: null };
    const parsed = parseDraft(res.text);
    if (!parsed) return { ok: false as const, message: "L'IA n'a pas pu lire ce produit. Essayez une photo plus nette.", draft: null };
    return { ok: true as const, message: null, draft: { ...parsed, imageUrl: data.imageUrl } as Draft };
  });

/** Fiche produit à partir du lien d'un produit (copié depuis une autre plateforme). */
export const draftProductFromLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string }) => z.object({ url: z.string().url().max(2000) }).parse(input))
  .handler(async ({ data }) => {
    let html = "";
    try {
      const page = await fetch(data.url, { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" });
      if (!page.ok) return { ok: false as const, message: "La page du produit est inaccessible.", draft: null };
      html = await page.text();
    } catch {
      return { ok: false as const, message: "Impossible de lire ce lien.", draft: null };
    }

    const og = (prop: string) => {
      const m = html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"));
      return m ? m[1] : null;
    };
    const imageUrl = og("og:image");
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 6000);

    const res = await analyzeWithGemini({
      prompt: `${PROMPT_RULES}\n\nContenu de la page du produit :\n${text}`,
    });
    if (!res.ok) return { ok: false as const, message: res.message, draft: null };
    const parsed = parseDraft(res.text);
    if (!parsed) return { ok: false as const, message: "L'IA n'a pas pu lire ce produit depuis ce lien.", draft: null };
    return { ok: true as const, message: null, draft: { ...parsed, imageUrl } as Draft };
  });

/**
 * Suggestion de description uniquement : texte seulement, l'image du produit n'est jamais modifiée.
 */
export const suggestDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; category: string; imageUrl: string | null }) =>
    z
      .object({
        name: z.string().trim().min(2).max(120),
        category: z.string().trim().max(80),
        imageUrl: z.string().url().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    let images: { mimeType: "image/jpeg" | "image/png" | "image/webp"; data: string }[] = [];
    if (data.imageUrl) {
      try {
        const r = await fetch(data.imageUrl);
        const type = (r.headers.get("content-type") ?? "").split(";")[0];
        if (r.ok && ["image/jpeg", "image/png", "image/webp"].includes(type)) {
          const buf = Buffer.from(await r.arrayBuffer());
          if (buf.length < 6_000_000) images = [{ mimeType: type as "image/jpeg", data: buf.toString("base64") }];
        }
      } catch {
        images = [];
      }
    }
    const res = await analyzeWithGemini({
      prompt:
        `${PROMPT_RULES}\n\nProduit : ${data.name}${data.category ? ` (catégorie : ${data.category})` : ""}.` +
        " Rédige seulement la description (2 à 4 phrases). Réponds en JSON avec la seule clé « description ».",
      images,
    });
    if (!res.ok) return { ok: false as const, message: res.message, description: "" };
    const m = res.text.match(/\{[\s\S]*\}/);
    try {
      const j = m ? (JSON.parse(m[0]) as { description?: string }) : null;
      return { ok: true as const, message: null, description: (j?.description ?? res.text).trim().slice(0, 800) };
    } catch {
      return { ok: true as const, message: null, description: res.text.trim().slice(0, 800) };
    }
  });
