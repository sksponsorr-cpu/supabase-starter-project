import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Bucket Supabase privé pour les messages vocaux du support (à créer : Storage > New bucket > "support-voice", privé). */
const VOICE_BUCKET = "support-voice";

/**
 * Envoie un message vocal au support : l'audio est stocké dans le bucket privé,
 * et le chemin est renvoyé pour être joint au message de support.
 */
export const uploadSupportVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { audioBase64: string; mimeType: string }) =>
    z
      .object({
        audioBase64: z.string().min(100).max(3_000_000),
        mimeType: z.string().regex(/^audio\//),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const bytes = Buffer.from(data.audioBase64, "base64");
    if (bytes.length > 2_000_000) {
      return { ok: false as const, message: "Le message vocal est trop long (2 Mo maximum)." };
    }
    const ext = data.mimeType.includes("mp4") ? "m4a" : data.mimeType.includes("ogg") ? "ogg" : "webm";
    const path = `${context.userId}/${Date.now()}.${ext}`;
    const { error } = await context.supabase.storage
      .from(VOICE_BUCKET)
      .upload(path, bytes, { contentType: data.mimeType, upsert: false });
    if (error) return { ok: false as const, message: "Envoi du vocal impossible. Réessaie ou écris ton message." };
    return { ok: true as const, path };
  });
