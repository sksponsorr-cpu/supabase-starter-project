import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type EnhanceInput = {
  prompt: string;
  mediaType: "image" | "video";
  language?: string;
};




export const enhancePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EnhanceInput) => {
    if (!input?.prompt?.trim()) throw new Error("Prompt requis");
    return {
      prompt: input.prompt.trim().slice(0, 1200),
      mediaType: input.mediaType === "image" ? ("image" as const) : ("video" as const),
      language: String(input.language ?? "fr").slice(0, 8),
    };
  })
  .handler(async ({ data }) => {
    // Import dynamique → garantit l'exécution côté serveur (Nitro runtime),
    // où process.env["XAI_API_KEY"] est disponible.
    // Pattern identique à generation.functions.ts → fal.server.ts / xai.server.ts.
    const { enhancePromptWithXai } = await import("@/lib/services/xai.server");
    return enhancePromptWithXai(data);
  });

